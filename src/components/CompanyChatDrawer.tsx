import React, { useState, useRef, useEffect } from 'react';
import { 
  UserProfile, 
  ChatMessage 
} from '../types';
import { 
  X, 
  Send, 
  Image as ImageIcon, 
  Smile, 
  Users, 
  Search, 
  Shield, 
  Check, 
  Wrench, 
  AlertCircle, 
  Boxes, 
  Sparkles, 
  Clock, 
  Paperclip,
  Trash2
} from 'lucide-react';
import { compressDataUrl } from '../utils/imageCompressor';

interface CompanyChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  messages: ChatMessage[];
  onSendMessage: (msg: { text: string; imageUrl?: string }) => Promise<void>;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  allUsers?: UserProfile[];
}

const EMOJI_REACTIONS = ['👍', '❤️', '🔧', '✅', '⚠️', '🔥'];

export default function CompanyChatDrawer({
  isOpen,
  onClose,
  currentUser,
  messages,
  onSendMessage,
  onToggleReaction,
  allUsers = []
}: CompanyChatDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isSending) return;

    const textToSend = inputText.trim();
    const imageToSend = selectedImage;

    setInputText('');
    setSelectedImage(null);
    setIsSending(true);

    try {
      await onSendMessage({
        text: textToSend,
        imageUrl: imageToSend || undefined
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawData = event.target?.result as string;
        if (rawData) {
          const compressed = await compressDataUrl(rawData, 1024, 0.7);
          setSelectedImage(compressed);
        }
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to compress image:', error);
      setIsUploadingImage(false);
    }
  };

  // Filter messages by search
  const filteredMessages = messages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.text.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q) ||
      m.senderEmail.toLowerCase().includes(q)
    );
  });

  const formatMessageTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatMessageDateHeader = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end text-left">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Container */}
      <div className="relative w-full max-w-lg bg-slate-900 text-slate-100 h-full flex flex-col shadow-2xl border-l border-slate-800 z-10 animate-in slide-in-from-right duration-200">
        {/* HEADER */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">Workshop Company Chat</h2>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                All team members & operators communicate in real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800/80 flex items-center gap-2 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search messages or team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-slate-200 placeholder:text-slate-500 focus:ring-0 focus:outline-hidden text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-white text-[10px]"
            >
              Clear
            </button>
          )}
        </div>

        {/* MESSAGES FEED */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/90">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mb-3 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">Welcome to Workshop Chat</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Broadcast updates on incoming components, inspection flags, pre-quotes, or store supplies.
              </p>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const isMe = msg.senderUid === currentUser.uid;
              const prevMsg = filteredMessages[index - 1];
              const showDateHeader = !prevMsg || formatMessageDateHeader(prevMsg.createdAt) !== formatMessageDateHeader(msg.createdAt);
              const senderInitial = (msg.senderName || msg.senderEmail || 'U').charAt(0).toUpperCase();

              return (
                <React.Fragment key={msg.id}>
                  {showDateHeader && (
                    <div className="flex items-center justify-center my-2">
                      <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-750 shadow-2xs">
                        {formatMessageDateHeader(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-slate-200 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-slate-700 shadow-xs mt-0.5">
                      {senderInitial}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender Name & Role */}
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-300">
                          {isMe ? 'You' : msg.senderName || msg.senderEmail}
                        </span>
                        {msg.senderRole && (
                          <span className="text-[9px] font-bold text-blue-400 bg-blue-950/60 border border-blue-800 px-1.5 py-0.2 rounded-sm">
                            {msg.senderRole}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-500 font-mono">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Content Box */}
                      <div 
                        className={`rounded-2xl px-3.5 py-2 text-xs shadow-xs leading-relaxed relative group ${
                          isMe 
                            ? 'bg-blue-600 text-white rounded-tr-xs' 
                            : 'bg-slate-800 text-slate-100 border border-slate-750 rounded-tl-xs'
                        }`}
                      >
                        {/* Attached Image */}
                        {msg.imageUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-white/10 max-h-56">
                            <img 
                              src={msg.imageUrl} 
                              alt="Attachment" 
                              className="w-full h-auto object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}

                        {/* Text */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}

                        {/* Quick Reaction Button */}
                        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                          isMe ? '-left-14' : '-right-14'
                        }`}>
                          <button
                            onClick={() => onToggleReaction(msg.id, '👍')}
                            className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs transition-transform active:scale-125 cursor-pointer shadow-sm"
                            title="React with 👍"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => onToggleReaction(msg.id, '🔧')}
                            className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs transition-transform active:scale-125 cursor-pointer shadow-sm"
                            title="React with 🔧"
                          >
                            🔧
                          </button>
                        </div>
                      </div>

                      {/* Emoji Reactions List */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 px-1">
                          {Object.entries(msg.reactions).map(([emoji, uids]) => {
                            if (!uids || uids.length === 0) return null;
                            const hasReacted = uids.includes(currentUser.uid);

                            return (
                              <button
                                key={emoji}
                                onClick={() => onToggleReaction(msg.id, emoji)}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer ${
                                  hasReacted 
                                    ? 'bg-blue-900/60 border-blue-500 text-blue-200' 
                                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-bold">{uids.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* IMAGE PREVIEW BEFORE SENDING */}
        {selectedImage && (
          <div className="p-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={selectedImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />
              <div>
                <p className="text-xs font-bold text-slate-200">Image attached</p>
                <p className="text-[10px] text-slate-400">Ready to send</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* INPUT COMPOSER */}
        <div className="p-3.5 bg-slate-850 border-t border-slate-800 shrink-0">
          <form onSubmit={handleSend} className="flex flex-col gap-2">
            <div className="flex items-end gap-2 bg-slate-900 border border-slate-750 rounded-2xl p-2 focus-within:border-blue-500 shadow-inner">
              {/* Image upload button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageFileChange} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Attach photo"
              >
                <ImageIcon className={`w-4 h-4 ${isUploadingImage ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              {/* Text Input */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Press Enter to send)"
                rows={1}
                className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 resize-none border-0 focus:ring-0 focus:outline-hidden py-1 max-h-28 overflow-y-auto"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!inputText.trim() && !selectedImage) || isSending}
                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-sm active:scale-95"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>Shift + Enter for new line</span>
              <span>Logged in as: <strong className="text-slate-400">{currentUser.displayName || currentUser.email}</strong></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
