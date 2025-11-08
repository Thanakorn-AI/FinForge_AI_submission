#!/usr/bin/env python3
"""
Multi-PDF Table Extraction
Process multiple financial statement PDFs in batch with parallel processing.
"""

import sys
from pathlib import Path
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed
from extract_tables_ade import ADETableExtractor
from parse_tables_from_markdown import MarkdownTableParser


def process_single_pdf(pdf_path: str, base_output_dir: str, index: int, total: int) -> dict:
    """
    Process a single PDF file.

    Args:
        pdf_path: Path to PDF file
        base_output_dir: Base directory for outputs
        index: Current PDF index (1-based)
        total: Total number of PDFs

    Returns:
        dict with processing result
    """
    extractor = ADETableExtractor()
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        print(f"\n❌ File not found: {pdf_path}")
        return {
            'pdf_name': pdf_path.name,
            'output_dir': '',
            'num_tables': 0,
            'status': 'error',
            'error': 'File not found'
        }

    print(f"\n{'='*60}")
    print(f"Processing PDF {index}/{total}: {pdf_path.name}")
    print(f"{'='*60}")

    try:
        # Create output directory for this PDF
        output_dir = Path(base_output_dir) / pdf_path.stem
        output_dir.mkdir(parents=True, exist_ok=True)

        # Check if already processed (ai_analysis.json exists)
        ai_analysis_file = output_dir / "ai_analysis.json"
        if ai_analysis_file.exists():
            print(f"\n✓ Already processed - using cached data")
            print(f"  Found: {ai_analysis_file}")

            # Count existing CSV tables
            csv_files = list(output_dir.glob("table_*.csv"))

            return {
                'pdf_name': pdf_path.name,
                'output_dir': str(output_dir),
                'num_tables': len(csv_files),
                'status': 'success',
                'cached': True
            }

        # Step 1: Extract with ADE
        print(f"\n[1/2] Running ADE extraction...")
        extractor.extract_from_pdf(str(pdf_path), output_dir=str(output_dir))

        # Step 2: Parse markdown tables
        print(f"\n[2/2] Parsing HTML tables from markdown...")
        markdown_file = output_dir / f"{pdf_path.stem}_full.md"

        if markdown_file.exists():
            parser = MarkdownTableParser(str(markdown_file))
            tables = parser.extract_tables()
            parser.save_tables(tables, output_dir=str(output_dir))

            return {
                'pdf_name': pdf_path.name,
                'output_dir': str(output_dir),
                'num_tables': len(tables),
                'status': 'success',
                'cached': False
            }
        else:
            return {
                'pdf_name': pdf_path.name,
                'output_dir': str(output_dir),
                'num_tables': 0,
                'status': 'error',
                'error': 'Markdown file not created',
                'cached': False
            }

    except Exception as e:
        print(f"\n❌ Error processing {pdf_path.name}: {e}")
        return {
            'pdf_name': pdf_path.name,
            'output_dir': str(output_dir) if 'output_dir' in locals() else '',
            'num_tables': 0,
            'status': 'error',
            'error': str(e)
        }


def process_multiple_pdfs(pdf_paths: List[str], base_output_dir: str = "output", max_workers: int = 3):
    """
    Process multiple PDF files in parallel and extract tables from each.

    Args:
        pdf_paths: List of paths to PDF files
        base_output_dir: Base directory for outputs (subdirectory per PDF)
        max_workers: Maximum number of parallel workers (default: 3)
    """
    print(f"\n🚀 Starting parallel processing of {len(pdf_paths)} PDFs with {max_workers} workers...")

    results = []

    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all PDF processing tasks
        future_to_pdf = {
            executor.submit(process_single_pdf, pdf_path, base_output_dir, i, len(pdf_paths)): pdf_path
            for i, pdf_path in enumerate(pdf_paths, 1)
        }

        # Collect results as they complete
        for future in as_completed(future_to_pdf):
            pdf_path = future_to_pdf[future]
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"\n❌ Unexpected error processing {pdf_path}: {e}")
                results.append({
                    'pdf_name': Path(pdf_path).name,
                    'output_dir': '',
                    'num_tables': 0,
                    'status': 'error',
                    'error': str(e)
                })

    # Print summary
    print(f"\n{'='*60}")
    print(f"BATCH PROCESSING COMPLETE")
    print(f"{'='*60}")

    total_tables = sum(r['num_tables'] for r in results)
    successful = sum(1 for r in results if r['status'] == 'success')

    print(f"\nProcessed: {len(results)} PDFs")
    print(f"Successful: {successful}/{len(results)}")
    print(f"Total tables extracted: {total_tables}")

    print(f"\nResults by file:")
    for result in results:
        status_icon = "✅" if result['status'] == 'success' else "❌"
        print(f"  {status_icon} {result['pdf_name']}: {result['num_tables']} tables")
        if result['status'] == 'error':
            print(f"      Error: {result.get('error', 'Unknown')}")

    return results


def main():
    """Main entry point for batch processing."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Extract tables from multiple PDF files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single file
  python multi_pdf_extract.py financial_2024.pdf

  # Process multiple files
  python multi_pdf_extract.py file1.pdf file2.pdf file3.pdf

  # Process with custom output directory
  python multi_pdf_extract.py --output-dir results *.pdf
        """
    )

    parser.add_argument(
        'pdf_files',
        nargs='+',
        help='PDF files to process'
    )
    parser.add_argument(
        '--output-dir',
        default='output',
        help='Base output directory (default: output)'
    )

    args = parser.parse_args()

    # Process all PDFs
    results = process_multiple_pdfs(args.pdf_files, args.output_dir)

    # Exit with error if any failed
    if any(r['status'] == 'error' for r in results):
        sys.exit(1)


if __name__ == '__main__':
    main()
