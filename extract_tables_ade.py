#!/usr/bin/env python3
"""
ADE Table Extraction Script
Extracts tables from financial statement PDFs using LandingAI's Advanced Document Extraction API.
Uses the official agentic-doc library.
"""

import os
import json
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import ADE library
try:
    from agentic_doc.parse import parse
except ImportError:
    print("ERROR: agentic-doc library not installed.")
    print("Install it with: uv add agentic-doc")
    raise


class ADETableExtractor:
    """Extract tables from PDFs using LandingAI ADE library."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize with API key from environment or parameter."""
        self.api_key = api_key or os.getenv("VISION_AGENT_API_KEY")
        if not self.api_key:
            raise ValueError("API key not found. Set VISION_AGENT_API_KEY in .env file")

        # Set the environment variable for the library to use
        os.environ["VISION_AGENT_API_KEY"] = self.api_key

    def extract_tables(self, chunks: List) -> List[dict]:
        """
        Filter and extract table chunks from parsed result.

        Args:
            chunks: List of chunk objects from ADE

        Returns:
            List of table chunks as dictionaries
        """
        tables = []
        for chunk in chunks:
            # Check if this is a table chunk
            if hasattr(chunk, 'type') and chunk.type == 'table':
                table_data = {
                    'type': chunk.type,
                    'page': getattr(chunk, 'page', None),
                    'content': getattr(chunk, 'content', None),
                    'html': getattr(chunk, 'html', None),
                    'markdown': getattr(chunk, 'markdown', None),
                    'metadata': getattr(chunk, 'metadata', {}),
                }
                tables.append(table_data)

        print(f"\n✓ Found {len(tables)} table(s) out of {len(chunks)} total chunks")

        for i, table in enumerate(tables, 1):
            page = table.get('page', 'unknown')
            print(f"  Table {i}: Page {page}")

        return tables

    def save_results(self, tables: List[dict], full_result, output_dir: str, pdf_name: str):
        """
        Save extracted tables and full results to JSON files.

        Args:
            tables: List of table chunks
            full_result: Full parse result object
            output_dir: Directory to save files
            pdf_name: Name of source PDF (without extension)
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save table chunks
        tables_file = output_path / f"{pdf_name}_tables.json"
        with open(tables_file, 'w', encoding='utf-8') as f:
            json.dump(tables, f, ensure_ascii=False, indent=2)
        print(f"✓ Saved {len(tables)} tables to {tables_file}")

        # Save full markdown
        markdown_file = output_path / f"{pdf_name}_full.md"
        with open(markdown_file, 'w', encoding='utf-8') as f:
            f.write(full_result.markdown)
        print(f"✓ Saved full markdown to {markdown_file}")

        # Save all chunks metadata
        all_chunks = []
        for chunk in full_result.chunks:
            chunk_data = {
                'type': getattr(chunk, 'type', None),
                'page': getattr(chunk, 'page', None),
                'content': getattr(chunk, 'content', None)[:200] if hasattr(chunk, 'content') else None,  # Truncate for readability
            }
            all_chunks.append(chunk_data)

        chunks_file = output_path / f"{pdf_name}_all_chunks.json"
        with open(chunks_file, 'w', encoding='utf-8') as f:
            json.dump(all_chunks, f, ensure_ascii=False, indent=2)
        print(f"✓ Saved all chunks metadata to {chunks_file}")

    def extract_from_pdf(self, pdf_path: str, output_dir: str = "output") -> List[dict]:
        """
        Complete extraction workflow: parse PDF, extract tables, save results.

        Args:
            pdf_path: Path to PDF file
            output_dir: Directory to save results

        Returns:
            List of extracted table chunks
        """
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        print(f"Processing {pdf_path.name} ({pdf_path.stat().st_size / 1024 / 1024:.2f} MB)...")
        print("This may take a few minutes for large documents...\n")

        # Parse the document using ADE
        results = parse(str(pdf_path))

        if not results or len(results) == 0:
            raise RuntimeError("No results returned from ADE parse")

        # Get first result (single document)
        result = results[0]

        # Extract table chunks
        tables = self.extract_tables(result.chunks)

        # Save all results
        pdf_name = pdf_path.stem
        self.save_results(tables, result, output_dir, pdf_name)

        return tables


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Extract tables from PDF using LandingAI ADE')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--output-dir', default='output', help='Output directory (default: output)')
    parser.add_argument('--api-key', help='API key (default: from VISION_AGENT_API_KEY env var)')

    args = parser.parse_args()

    try:
        extractor = ADETableExtractor(api_key=args.api_key)
        tables = extractor.extract_from_pdf(args.pdf_path, args.output_dir)

        print(f"\n{'='*60}")
        print(f"SUCCESS: Extracted {len(tables)} tables")
        print(f"{'='*60}")

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR: {e}")
        print(f"{'='*60}")
        raise


if __name__ == '__main__':
    main()
