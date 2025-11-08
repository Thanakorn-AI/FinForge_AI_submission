# Quick Start Guide

## 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env and add your API keys
```

## 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

## 3. Install Node.js dependencies

```bash
# Backend
cd artifact-app/server
npm install

# Frontend
cd ../client
npm install
```

## 4. Start all servers

**Terminal 1 - FastAPI:**
```bash
cd artifact-app/python-api
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Agent Server:**
```bash
cd artifact-app/server
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd artifact-app/client
npm run dev
```

**Terminal 4 - Open browser:**
```
http://localhost:5173
```

## 5. Upload PDFs and start chatting!

Upload Thai financial PDFs and ask questions like:
- "Create an Excel analysis of the company's 3-year trends"
- "Show me revenue growth visualization"
