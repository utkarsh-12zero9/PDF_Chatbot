FROM node:20-alpine

WORKDIR /app

# Copy package manifests first for better layer caching
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && npm install

# Copy the backend source code
COPY backend ./backend

# Build the TypeScript app
RUN cd backend && npm run build

# Expose the app port
EXPOSE 8000

# Run the compiled Node.js backend
CMD ["sh", "-c", "cd /app/backend && npm start"]
