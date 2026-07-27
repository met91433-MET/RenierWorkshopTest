/**
 * Image compression utility to ensure photo uploads fit comfortably
 * within Firestore's 1MB per-document limit.
 */

export async function compressDataUrl(
  dataUrl: string, 
  maxDim: number = 1024, 
  quality: number = 0.65
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG data URL
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}

export async function compressFile(
  file: File, 
  maxDim: number = 1024, 
  quality: number = 0.65
): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string || '';
      if (file.type.startsWith('image/')) {
        const compressedDataUrl = await compressDataUrl(rawDataUrl, maxDim, quality);
        const approxSize = Math.round((compressedDataUrl.length * 3) / 4);
        resolve({ dataUrl: compressedDataUrl, size: approxSize });
      } else {
        const approxSize = Math.round((rawDataUrl.length * 3) / 4);
        resolve({ dataUrl: rawDataUrl, size: approxSize });
      }
    };
    reader.onerror = () => {
      resolve({ dataUrl: '', size: 0 });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sanitizes and compresses all images on a Job object before saving to Firestore,
 * guaranteeing the document stays under Firestore's 1,048,576 byte hard limit.
 */
export async function sanitizeJobForFirestoreAsync(job: any): Promise<any> {
  if (!job) return job;

  const jobCopy = JSON.parse(JSON.stringify(job));

  if (Array.isArray(jobCopy.files) && jobCopy.files.length > 0) {
    const compressedFiles = [];
    for (const f of jobCopy.files) {
      if (f.dataUrl && f.dataUrl.startsWith('data:image')) {
        // Compress if the base64 string is large (> 50KB)
        if (f.dataUrl.length > 60000) {
          const compressed = await compressDataUrl(f.dataUrl, 1024, 0.65);
          compressedFiles.push({
            ...f,
            dataUrl: compressed,
            size: Math.round((compressed.length * 3) / 4)
          });
        } else {
          compressedFiles.push(f);
        }
      } else {
        compressedFiles.push(f);
      }
    }
    jobCopy.files = compressedFiles;
  }

  // Safety check total stringified JSON size
  let jsonString = JSON.stringify(jobCopy);
  const MAX_ALLOWED_BYTES = 850000; // ~850KB, well under 1MB

  if (jsonString.length > MAX_ALLOWED_BYTES && Array.isArray(jobCopy.files)) {
    // If still too large, further compress images with smaller dimensions or quality
    const ultraCompressedFiles = [];
    for (const f of jobCopy.files) {
      if (f.dataUrl && f.dataUrl.startsWith('data:image')) {
        const ultraCompressed = await compressDataUrl(f.dataUrl, 800, 0.5);
        ultraCompressedFiles.push({
          ...f,
          dataUrl: ultraCompressed,
          size: Math.round((ultraCompressed.length * 3) / 4)
        });
      } else {
        ultraCompressedFiles.push(f);
      }
    }
    jobCopy.files = ultraCompressedFiles;
    jsonString = JSON.stringify(jobCopy);
  }

  // Final emergency trim if document is still exceeding 850KB (e.g. huge non-image files or extreme number of files)
  if (jsonString.length > MAX_ALLOWED_BYTES && Array.isArray(jobCopy.files)) {
    while (JSON.stringify(jobCopy).length > MAX_ALLOWED_BYTES && jobCopy.files.length > 2) {
      jobCopy.files.pop(); // Remove oldest/excess file to save document
    }
  }

  return jobCopy;
}
