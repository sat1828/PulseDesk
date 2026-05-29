FROM python:3.12-slim

RUN addgroup --system pulsedesk && adduser --system --no-create-home --ingroup pulsedesk pulsedesk

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY nlp_service.py .

USER pulsedesk

EXPOSE 5001

CMD ["uvicorn", "nlp_service:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2"]
