FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY engine/service.py engine/pipeline.py ./
RUN useradd --system --no-create-home renderer
USER renderer
EXPOSE 8080
CMD ["python", "-u", "service.py"]
