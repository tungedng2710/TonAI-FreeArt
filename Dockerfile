FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py engine.py ./
COPY static ./static

USER 65532:65532

EXPOSE 7863

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7863"]
