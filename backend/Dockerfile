# Backend container for Hugging Face Spaces (free CPU: 2 vCPU, 16 GB RAM — enough for TensorFlow).
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt tensorflow-cpu==2.21.0

COPY . .

# Spaces run the app as a normal user, so the database lives in /tmp (it resets when the Space restarts;
# the demo accounts are created again automatically).
ENV PHYSIO_DB=/tmp/physioplay.db
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
