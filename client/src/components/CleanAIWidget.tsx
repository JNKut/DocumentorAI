import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface Conversation {
  id: number;
  sessionId: string;
  documentId?: number;
}

export default function CleanAIWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
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

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error('No conversation available');
      
      const res = await apiRequest('POST', `/api/conversations/${conversationId}/messages`, { content });
      return res.json();
    },
    onSuccess: async (data) => {
      // Force immediate refetch of messages
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      setTimeout(async () => {
        await refetchMessages();
      }, 1000); // Wait 1s for backend to process AI response
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

  // Get messages - keep them fresh and persistent during session
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
    staleTime: 0,
    refetchInterval: 2000, // Refetch every 2 seconds to ensure messages stay
  });

  const messageList = (messages as Message[]) || [];

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
    <div className="fixed bottom-0 right-0 z-50 font-sans pointer-events-auto">
      {/* Collapsed State - Circular Button */}
      {!isOpen && (
        <div className="relative m-4">
          <Button
            onClick={toggleWidget}
            className="w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary hover:bg-primary/90"
          >
            <MessageCircle className="w-7 h-7" />
          </Button>
          {messageList && messageList.length > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {messageList.length}
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

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Welcome Message */}
            {(!messageList || messageList.length === 0) && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-gray-100 rounded-lg p-2 max-w-[80%]">
                  <p className="text-xs text-gray-700">
                    Hi! I'm your AI assistant. How can I help you today?
                  </p>
                </div>
              </div>
            )}



            {/* Messages */}
            {messageList && messageList.length > 0 && messageList.map((msg: Message) => (
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