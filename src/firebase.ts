import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0135595640",
  appId: "1:144700481652:web:72d8cc9fe2197a7c287121",
  apiKey: "AIzaSyCt8nAtuXR7T1eXedSsqVSQf780gN2J8rs",
  authDomain: "gen-lang-client-0135595640.firebaseapp.com",
  storageBucket: "gen-lang-client-0135595640.firebasestorage.app",
  messagingSenderId: "144700481652"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId using standard getFirestore signature
export const db = getFirestore(app, "ai-studio-cede40d1-eb40-49d8-a71f-b9ff15b17469");

// Initialize Auth
export const auth = getAuth(app);

// Connection test as required by firebase-integration skill
export async function testConnection() {
  try {
    // Attempt a dry server-side fetch to test connectivity
    await getDocFromServer(doc(db, 'config', 'test-connection'));
    console.log("Firebase connection established successfully!");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firebase client is currently offline. Retrying...");
    } else {
      console.log("Firebase initialized (database may be empty):", error);
    }
    return false;
  }
}

// Perform connection test on load
testConnection();
