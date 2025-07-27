# AI Document Chat Widget

## Overview

This is a full-stack web application that provides an embeddable AI chat widget capable of being trained with uploaded documents. The system allows users to upload documents (PDF, DOCX, TXT), processes them into searchable chunks with embeddings, and enables natural language conversations about the document content using OpenAI's GPT models.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **File Processing**: Multer for file uploads with custom text extraction
- **AI Integration**: OpenAI API for embeddings and chat completions

### Key Components

#### Document Processing Pipeline
1. **File Upload**: Multer handles multipart form uploads with 10MB size limit
2. **Text Extraction**: Custom service extracts text from PDF, DOCX, and plain text files
3. **Chunking**: Intelligent text chunking with configurable size (1000 chars) and overlap (200 chars)
4. **Embeddings**: OpenAI text-embedding-3-small model generates vector embeddings for each chunk
5. **Storage**: Document metadata, chunks, and embeddings stored in PostgreSQL

#### Chat System
1. **Session Management**: Each chat session gets a unique session ID
2. **Conversation Tracking**: Messages linked to conversations and documents
3. **Retrieval**: Cosine similarity search finds relevant document chunks
4. **Response Generation**: GPT-4o generates contextual responses using retrieved chunks
5. **Source Attribution**: Responses include references to source document chunks

#### Widget Embedding
- **Standalone Page**: `/` serves the widget demo page
- **Embeddable Version**: `/embed` provides the widget for iframe embedding
- **JavaScript API**: Global `AIWidget` object for parent window integration

## Data Flow

1. **Document Upload Flow**:
   ```
   File Upload → Text Extraction → Chunking → Embedding Generation → Database Storage
   ```

2. **Chat Flow**:
   ```
   User Message → Session/Conversation Creation → Embedding Search → 
   Context Retrieval → GPT Response → Message Storage → UI Update
   ```

3. **Widget Integration Flow**:
   ```
   Parent Site → Iframe/Script Load → Widget Initialization → 
   API Configuration → Document Training → Chat Interaction
   ```

## External Dependencies

### Core Dependencies
- **OpenAI API**: Text embeddings and chat completions (requires API key)
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Infrastructure**: Development and deployment platform

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production
- **Drizzle Kit**: Database schema management and migrations
- **Tailwind CSS**: Utility-first styling framework

### UI Components
- **Radix UI**: Accessible, unstyled component primitives
- **Lucide React**: Consistent icon library
- **Class Variance Authority**: Type-safe variant management

## Deployment Strategy

### Development Environment
- **Process**: `npm run dev` starts TypeScript server with hot reload
- **Port**: Application runs on port 5000
- **Database**: Uses Neon PostgreSQL with environment variable configuration

### Production Build
1. **Frontend**: Vite builds React app to `dist/public`
2. **Backend**: ESBuild bundles server code to `dist/index.js`
3. **Deployment**: Replit autoscale deployment with build/run commands
4. **Environment**: Production mode serves static files and API

### Database Management
- **Schema**: Defined in `shared/schema.ts` using Drizzle ORM
- **Migrations**: `npm run db:push` applies schema changes
- **Connection**: Configured via `DATABASE_URL` environment variable

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment mode (development/production)

## Recent Changes

- June 18, 2025: Initial AI document chat widget implementation
- June 18, 2025: Fixed widget positioning to prevent off-screen overflow with responsive constraints  
- June 18, 2025: Complete widget redesign - simplified chat interface, better positioning on right side, removed complex document upload UI for cleaner chat experience
- June 18, 2025: Converted from user-trainable system to built-in knowledge base - AI now uses server-side knowledge base file loaded at startup, removed user training interface
- June 18, 2025: Fixed message display issues - AI responses now appear correctly in chat widget, removed debug information
- June 18, 2025: Verified knowledge base integration - AI assistant now properly uses content from server/knowledge-base.txt to provide contextual responses about Shop Twist and Thread services
- June 18, 2025: Configured session-based message persistence - chat messages remain visible throughout user's session without requiring reload persistence
- June 20, 2025: Fixed knowledge base retrieval system - AI now correctly uses pricing information from knowledge-base.txt (base hoodie price: $60) and provides accurate responses with source attribution
- July 11, 2025: Fixed widget integration isolation - created transparent /widget route that shows only the floating AI chat button without any background content for clean website embedding
- July 26, 2025: Configured PostgreSQL database and production deployment setup - app now uses database storage in production for data persistence, fixed TypeScript errors, ready for always-on Replit Core deployment
- July 27, 2025: Created comprehensive Railway deployment guide for always-on hosting - Railway selected as best platform for reliable 24/7 widget hosting with automatic PostgreSQL database, Git-based deployments, and professional SSL certificates

## User Preferences

Preferred communication style: Simple, everyday language.