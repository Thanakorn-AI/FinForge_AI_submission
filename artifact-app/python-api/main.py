from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import sys
import json
import tempfile
import shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Add parent directory to path to import existing modules
sys.path.append(str(Path(__file__).parent.parent.parent))

from multi_pdf_extract import process_multiple_pdfs
from ai_table_analyzer import HybridTableAnalyzer

app = FastAPI(title="Financial Analysis API")

# CORS - allow React app to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# ENDPOINT 1: PDF Extraction
# ============================================
@app.post("/api/extract-pdf")
async def extract_pdf(files: list[UploadFile] = File(...)):
    """
    Upload PDFs, extract tables using LandingAI, analyze with AI
    """
    temp_dir = tempfile.mkdtemp()
    pdf_paths = []

    try:
        # Save uploaded files
        for file in files:
            temp_path = Path(temp_dir) / file.filename
            with open(temp_path, 'wb') as f:
                content = await file.read()
                f.write(content)
            pdf_paths.append(str(temp_path))

        # Run extraction pipeline (parallel processing inside)
        results = process_multiple_pdfs(pdf_paths, base_output_dir="output", max_workers=3)

        # Helper function to run analyzer in thread pool
        def run_analyzer(output_dir: str):
            """Blocking analyzer call - will be run in thread pool"""
            analyzer = HybridTableAnalyzer(output_dir)
            analysis_results = analyzer.analyze_all_tables()
            analyzer.save_analysis(analysis_results)

        # Run AI analysis in parallel for all non-cached results
        to_analyze = [r for r in results if r['status'] == 'success' and not r.get('cached', False)]
        if to_analyze:
            print(f"\n🔬 Running AI analysis on {len(to_analyze)} PDFs in parallel...")
            loop = asyncio.get_event_loop()
            # Create tasks for all analyzers
            tasks = [
                loop.run_in_executor(None, run_analyzer, result['output_dir'])
                for result in to_analyze
            ]
            # Wait for all to complete
            await asyncio.gather(*tasks)

        return {"status": "success", "results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        shutil.rmtree(temp_dir)

# ============================================
# ENDPOINT 2: List Extracted Data
# ============================================
@app.get("/api/list-extractions")
async def list_extractions():
    """
    List all extracted PDF directories in output/
    """
    output_dir = Path("output")
    if not output_dir.exists():
        return {"extractions": []}

    extractions = []
    for d in output_dir.iterdir():
        if d.is_dir():
            ai_json = d / "ai_analysis.json"
            if ai_json.exists():
                with open(ai_json, 'r') as f:
                    analysis = json.load(f)

                extractions.append({
                    "name": d.name,
                    "path": str(d),
                    "table_count": len(analysis),
                    "has_analysis": True
                })

    return {"extractions": extractions}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
