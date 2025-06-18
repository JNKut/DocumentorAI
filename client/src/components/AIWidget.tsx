import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Upload, Send, File, Trash2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sourceChunks?: string[];
  createdAt: string;
}

interface Document {
  id: number;
  originalName: string;
  size: number;
  chunks: number;
  createdAt: string;
}

interface Conversation {
  id: number;
  sessionId: string;
  documentId?: number;
}

export default function AIWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get or create conversation
  const conversationMutation = useMutation({
    mutationFn: async (data: { sessionId: string; documentId?: number }) => {
      const res = await apiRequest('POST', '/api/conversations', data);
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      setConversationId(data.id);
    }
  });

  // Upload document
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setDocumentId(data.id);
      toast({
        title: "Document uploaded",
        description: `${data.originalName} has been processed with ${data.chunks} chunks`,
      });
      
      // Create new conversation with document
      conversationMutation.mutate({ sessionId, documentId: data.id });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error('No conversation available');
      
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
      setMessage('');
      setIsTyping(false);
    },
    onError: (error: Error) => {
      setIsTyping(false);
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId,
  });

  // Get document info
  const { data: document } = useQuery<Document>({
    queryKey: ['/api/documents', documentId],
    enabled: !!documentId,
  });

  // Delete document
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      setDocumentId(null);
      setConversationId(null);
      queryClient.removeQueries({ queryKey: ['/api/documents'] });
      queryClient.removeQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: "Document removed",
        description: "Document and conversation history have been cleared",
      });
    }
  });

  useEffect(() => {
    if (isOpen && !conversationId) {
      conversationMutation.mutate({ sessionId });
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() || !conversationId) return;
    
    setIsTyping(true);
    sendMessageMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {/* Collapsed State - Circular Button */}
      {!isOpen && (
        <div className="relative">
          <Button
            onClick={toggleWidget}
            className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary hover:bg-primary/90 animate-bounce"
            style={{ animationDuration: '2s' }}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
          {messages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              1
            </div>
          )}
        </div>
      )}

      {/* Expanded State - Chat Window */}
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in-0 scale-in-95 duration-300 sm:w-[calc(100vw-2rem)] sm:h-[calc(100vh-8rem)] sm:bottom-4 sm:right-1 sm:left-1">
          
          {/* Header */}
          <div className="bg-primary text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs opacity-90">Online</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleWidget}
              className="w-8 h-8 hover:bg-white/20 rounded-full p-0 text-white hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Document Upload Section */}
          <div className="p-4 border-b border-gray-100">
            {!document && (
              <div
                className="bg-surface rounded-lg p-4 border-2 border-dashed border-gray-300 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Drop documents here or click to upload</p>
                <p className="text-xs text-gray-500">PDF, DOCX, TXT (Max 10MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                />
              </div>
            )}
            
            {/* Uploaded Document */}
            {document && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <File className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-700">{document.originalName}</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    Processed
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteDocumentMutation.mutate(document.id)}
                  className="text-gray-400 hover:text-red-500 p-1 h-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}

            {uploadMutation.isPending && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-sm text-blue-600">Processing document...</div>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
            
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="flex items-start space-x-2 animate-in fade-in-0 duration-300">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-md p-3 max-w-[80%]">
                  <p className="text-sm text-gray-800">
                    Hi! I'm your AI assistant. Upload a document to train me, then ask me anything about it.
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start space-x-2 animate-in fade-in-0 duration-300 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                
                <div className={`rounded-2xl p-3 max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-md' 
                    : 'bg-gray-100 rounded-tl-md'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                  {msg.sourceChunks && msg.sourceChunks.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
                      <File className="w-3 h-3" />
                      <span>Source: {document?.originalName || 'document'}</span>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-2 animate-in fade-in-0 duration-300">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-md p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask me anything about your document..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="resize-none pr-12 max-h-24"
                  rows={1}
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!message.trim() || !conversationId || sendMessageMutation.isPending}
                  className="absolute right-2 bottom-2 w-8 h-8 p-0"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Press Enter to send</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>AI Ready</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
