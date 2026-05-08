# syntax=docker/dockerfile:1.6
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for better layer caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Now copy source
COPY . .

# Collect static files at build-time (whitenoise will serve them)
RUN DJANGO_SECRET_KEY=build-only \
    DJANGO_DEBUG=False \
    DJANGO_ALLOWED_HOSTS=* \
    python manage.py collectstatic --noinput

# Non-root user with a real home directory (gunicorn writes a tmp lock there)
RUN useradd --system --uid 1001 --create-home --home-dir /home/appuser appuser \
    && chown -R appuser:appuser /app /home/appuser
USER appuser
ENV HOME=/home/appuser

EXPOSE 8000

# Healthcheck hits the API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8000/api/health/ || exit 1

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn eld_backend.wsgi --bind 0.0.0.0:8000 --workers 3 --access-logfile - --error-logfile -"]
