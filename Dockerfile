FROM python:3.10-slim

# Install system dependencies required for FAISS and building packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend/ ./backend/

# Expose the port (Railway provides the PORT environment variable)
EXPOSE 8000

# Run the FastAPI server
CMD uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}
