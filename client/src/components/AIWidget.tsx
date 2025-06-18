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
  const [showTraining, setShowTraining] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [message, setMessage] = useState('');
  const [trainingText, setTrainingText] = useState('');
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

  // Train with text
  const trainMutation = useMutation({
    mutationFn: async (text: string) => {
      // Create a text file from the training text
      const formData = new FormData();
      const blob = new Blob([text], { type: 'text/plain' });
      formData.append('document', blob, 'training-data.txt');
      
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Training failed');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setDocumentId(data.id);
      setShowTraining(false);
      setTrainingText('');
      toast({
        title: "AI trained successfully",
        description: `Assistant has been trained on your content`,
      });
      
      // Create new conversation with document
      conversationMutation.mutate({ sessionId, documentId: data.id });
    },
    onError: (error: Error) => {
      toast({
        title: "Training failed",
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
    onSuccess: (data) => {
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

  const handleTraining = () => {
    if (!trainingText.trim()) return;
    trainMutation.mutate(trainingText);
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
    <div className="fixed bottom-0 right-0 z-50 font-sans">
      {/* Collapsed State - Circular Button */}
      {!isOpen && (
        <div className="relative m-4">
          <Button
            onClick={toggleWidget}
            className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="w-7 h-7" />
          </Button>
          {messages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {messages.length}
            </div>
          )}
        </div>
      )}

      {/* Expanded State - Chat Window */}
      {isOpen && (
        <Card className="w-80 h-96 bg-white border border-gray-300 shadow-2xl flex flex-col m-4 rounded-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="bg-primary text-white p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <span className="font-medium">AI Assistant</span>
              {!documentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTraining(!showTraining)}
                  className="text-xs text-white/80 hover:text-white hover:bg-white/20 px-2 py-1 h-auto"
                >
                  Train
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleWidget}
              className="w-6 h-6 hover:bg-white/20 rounded-full p-0 text-white hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Training Section */}
          {showTraining && (
            <div className="p-3 bg-blue-50 border-b border-blue-200">
              <div className="mb-2">
                <label className="text-xs font-medium text-blue-800 mb-1 block">
                  Train the AI Assistant
                </label>
                <textarea
                  placeholder="Enter information for the AI to learn about..."
                  value={trainingText}
                  onChange={(e) => setTrainingText(e.target.value)}
                  className="w-full px-2 py-2 border border-blue-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={handleTraining}
                  disabled={!trainingText.trim() || trainMutation.isPending}
                  className="text-xs px-3 py-1 h-auto"
                >
                  {trainMutation.isPending ? 'Training...' : 'Train AI'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTraining(false)}
                  className="text-xs px-3 py-1 h-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2 max-w-[80%]">
                  <p className="text-xs text-gray-700">
                    {documentId 
                      ? "Hi! I've been trained and I'm ready to help. What would you like to know?"
                      : "Hi! I'm your AI assistant. Train me first or just start chatting!"
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start space-x-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                
                <div className={`rounded-lg p-2 max-w-[75%] ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="text-xs">{msg.content}</p>
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!message.trim() || !conversationId || sendMessageMutation.isPending}
                className="px-3 py-2 h-auto"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
