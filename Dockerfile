FROM python:3.11-slim

# Install system dependencies including FFmpeg for RTMP live streaming
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ensure upload directories exist
RUN mkdir -p uploads/temp

# Set default port (Render injects PORT dynamically)
ENV PORT=10000
EXPOSE $PORT

# Run Gunicorn with 1 worker & 8 threads to maintain consistent in-memory process state for FFmpeg
CMD ["sh", "-c", "gunicorn -w 1 -k gthread --threads 8 -b 0.0.0.0:${PORT:-10000} app:app"]
