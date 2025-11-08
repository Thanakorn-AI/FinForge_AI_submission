#!/usr/bin/env python3
"""
Hybrid AI Table Analyzer
Uses Claude Sonnet 4.5 to intelligently analyze financial tables.

Hybrid Approach:
1. Primary: tables.html (clean structure, ~500 tokens per table)
2. Secondary: _full.md (context for critical tables, ~1000 tokens)

Cost: ~$0.04 per PDF (12,500 tokens average)
"""

from pathlib import Path
from typing import List, Dict, Optional
import json
import os
from bs4 import BeautifulSoup
from anthropic import Anthropic
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class HybridTableAnalyzer:
    """
    Hybrid approach for table analysis:
    - Fast HTML analysis for all tables
    - Deep context analysis for critical tables (P&L, Balance Sheet, Fixed Assets)
    """

    def __init__(self, output_dir: str):
        """
        Initialize analyzer with output directory.

        Args:
            output_dir: Path to directory with extracted tables
                       (should contain tables.html and *_full.md)
        """
        self.output_dir = Path(output_dir)
        self.tables_html_path = self.output_dir / "tables.html"

        # Find _full.md file
        full_md_files = list(self.output_dir.parent.glob("*_full.md"))
        if full_md_files:
            self.full_md_path = full_md_files[0]
        else:
            self.full_md_path = None
            print(f"⚠️  Warning: No _full.md file found in {self.output_dir.parent}")

        # Load files
        self.tables_html = self._load_html()
        self.full_md = self._load_markdown() if self.full_md_path else ""

        # Initialize Claude client
        api_key = os.getenv("Claude_API_KEY")
        if not api_key:
            raise ValueError("Claude_API_KEY not found in .env file")
        self.client = Anthropic(api_key=api_key)

        print(f"✅ Initialized HybridTableAnalyzer")
        print(f"   Output dir: {self.output_dir}")
        print(f"   Tables HTML: {self.tables_html_path.exists()}")
        print(f"   Full MD: {self.full_md_path.exists() if self.full_md_path else False}")

    def _load_html(self) -> str:
        """Load tables.html file."""
        if not self.tables_html_path.exists():
            raise FileNotFoundError(f"tables.html not found at {self.tables_html_path}")

        with open(self.tables_html_path, 'r', encoding='utf-8') as f:
            return f.read()

    def _load_markdown(self) -> str:
        """Load _full.md file."""
        if not self.full_md_path or not self.full_md_path.exists():
            return ""

        with open(self.full_md_path, 'r', encoding='utf-8') as f:
            return f.read()

    def analyze_all_tables(self) -> List[Dict]:
        """
        Analyze all tables using hybrid approach.

        Returns:
            List of analysis results, one per table
        """
        print("\n🤖 Starting AI table analysis...")
        print(f"   Output directory: {self.output_dir}")
        results = []

        try:
            # Parse HTML
            print(f"   Parsing HTML file: {self.tables_html_path}")
            soup = BeautifulSoup(self.tables_html, 'html.parser')
            h2_tags = soup.find_all('h2')
            print(f"   Found {len(h2_tags)} tables in HTML")

        except Exception as e:
            print(f"   ❌ ERROR parsing HTML: {e}")
            import traceback
            traceback.print_exc()
            return []

        for idx, h2 in enumerate(h2_tags, 1):
            try:
                # Extract table number from h2 (e.g., "Table 7 (Page 0)")
                table_title = h2.get_text()
                table_number = self._extract_table_number(table_title)

                print(f"\n📊 [{idx}/{len(h2_tags)}] Processing {table_title} (table_number={table_number})...")

                # Find the table element after this h2
                table_elem = h2.find_next('table')
                if not table_elem:
                    print(f"   ⚠️  WARNING: No <table> element found after h2, skipping")
                    continue

                # Step 1: Quick HTML analysis
                table_html = str(table_elem)
                print(f"   Step 1: Running basic HTML analysis...")
                basic_result = self._analyze_table_html(table_html, table_number, table_title)
                print(f"   ✅ Basic analysis complete: type={basic_result.get('table_type')}")

                # Step 2: Check if needs context
                if self._needs_context(basic_result):
                    print(f"   🔍 Critical table detected (type={basic_result.get('table_type')}), fetching context...")
                    context = self._extract_context_from_md(table_number)

                    if context:
                        print(f"   Step 2: Running deep context analysis...")
                        final_result = self._analyze_with_context(
                            table_html, context, table_number, table_title
                        )
                        print(f"   ✅ Context analysis complete")
                    else:
                        print(f"   ⚠️  No context found in markdown, using basic analysis")
                        final_result = basic_result
                else:
                    print(f"   ✅ Basic analysis sufficient for this table type")
                    final_result = basic_result

                # Add metadata
                final_result['table_title'] = table_title
                final_result['original_csv'] = f"table_{table_number}_*.csv"

                results.append(final_result)
                print(f"   💾 Table {table_number} added to results")

            except Exception as e:
                print(f"   ❌ ERROR processing table {idx}: {e}")
                import traceback
                traceback.print_exc()
                # Continue with next table
                continue

        print(f"\n✅ Successfully analyzed {len(results)}/{len(h2_tags)} tables")
        return results

    def _extract_table_number(self, table_title: str) -> int:
        """Extract table number from title like 'Table 7 (Page 0)'."""
        import re
        match = re.search(r'Table (\d+)', table_title)
        if match:
            return int(match.group(1))
        return 0

    def _analyze_table_html(self, table_html: str, table_num: int, table_title: str) -> Dict:
        """
        Quick analysis from HTML only (~500 tokens input).

        Args:
            table_html: HTML string of the table
            table_num: Table number
            table_title: Table title from h2 tag

        Returns:
            Analysis result dict
        """
        prompt = f"""Analyze this financial statement table (may be Thai or international format).

**Table**: {table_title}

**HTML**:
{table_html}

Classify the table and extract key information.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "table_number": {table_num},
  "table_type": "balance_sheet" | "profit_loss" | "fixed_assets" | "notes" | "cash_flow" | "equity" | "other",
  "contains_depreciation": true or false,
  "key_headers": ["header1", "header2"],
  "confidence": "high" | "medium" | "low"
}}

Classification hints:
- balance_sheet: สินทรัพย์, หนี้สิน, ส่วนของผู้ถือหุ้น, Assets, Liabilities
- profit_loss: รายได้, รายจ่าย, กำไร, ขาดทุน, Revenue, Expense, EBIT
- fixed_assets: ที่ดิน อาคาร อุปกรณ์, ค่าเสื่อมราคา, Depreciation
- equity: ทุนเรือนหุ้น, กำไรสะสม, Retained Earnings
- cash_flow: เงินสด, Cash Flow
"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000
            )

            # Extract JSON from response
            content = response.content[0].text.strip()

            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:]
                content = content.strip()

            return json.loads(content)

        except Exception as e:
            print(f"   ❌ Error in basic analysis: {e}")
            return {
                "table_number": table_num,
                "table_type": "other",
                "contains_depreciation": False,
                "key_headers": [],
                "confidence": "low",
                "error": str(e)
            }

    def _needs_context(self, result: Dict) -> bool:
        """
        Check if table needs year context from markdown.

        Critical tables that need year:
        - P&L (profit_loss)
        - Balance Sheet (balance_sheet)
        - Fixed Assets (fixed_assets)
        """
        critical_types = ['profit_loss', 'balance_sheet', 'fixed_assets']
        return (
            result.get('table_type') in critical_types or
            result.get('contains_depreciation') == True
        )

    def _extract_context_from_md(self, table_number: int) -> str:
        """
        Extract context snippet from _full.md around table.

        For continued tables (like Table 8 which is continuation of Table 7),
        searches for the table by its position in the markdown.

        Args:
            table_number: Table number to find

        Returns:
            Context snippet (~200-500 tokens)
        """
        if not self.full_md:
            return ""

        lines = self.full_md.split('\n')

        # Strategy 1: Find by table number
        for i, line in enumerate(lines):
            # Look for patterns like "7 ที่ดิน อาคารและอุปกรณ์"
            # IMPORTANT: Must be at START of line to avoid false matches (like "8" in IDs)
            stripped_line = line.strip()
            if (stripped_line.startswith(f"{table_number} ") or
                stripped_line.startswith(f"{table_number}  ")):
                # Extract context (15 lines before and after)
                start = max(0, i - 15)
                end = min(len(lines), i + 35)  # More lines after (includes table)

                context_lines = lines[start:end]
                context = '\n'.join(context_lines)

                # Look for year in context
                if any(year in context for year in ['2567', '2566', '2565', '2564']):
                    return context

        # Strategy 2: Find by table tag position (for continued tables like Table 8)
        # Count <table> tags and get context around the Nth table
        table_count = 0
        for i, line in enumerate(lines):
            if '<table>' in line:
                table_count += 1
                if table_count == table_number:
                    # Found the Nth table (line index i)
                    # IMPORTANT: Find year that is CLOSEST to the table
                    # (to avoid picking up document year from page headers)

                    # Search backwards from table, find the CLOSEST year
                    closest_year_line = None
                    for back_offset in range(1, 15):  # Check up to 15 lines back
                        check_line_idx = i - back_offset
                        if check_line_idx < 0:
                            break

                        check_line = lines[check_line_idx]
                        # Check if this line contains a year (and ONLY a year, not in middle of sentence)
                        if any(year in check_line for year in ['2567', '2566', '2565', '2564']):
                            closest_year_line = check_line_idx
                            break  # Found closest year, stop searching

                    if closest_year_line is not None:
                        # Extract context around the closest year
                        start = max(0, closest_year_line - 10)
                        end = min(len(lines), i + 5)  # Up to just before table

                        context_lines = lines[start:end]
                        context = '\n'.join(context_lines)
                        return context

        return ""

    def _analyze_with_context(
        self,
        table_html: str,
        context: str,
        table_num: int,
        table_title: str
    ) -> Dict:
        """
        Detailed analysis with context from markdown (~1000 tokens input).

        Args:
            table_html: HTML string of the table
            context: Context snippet from markdown
            table_num: Table number
            table_title: Table title

        Returns:
            Enhanced analysis result with year
        """
        prompt = f"""Analyze this financial table with context (may be Thai or international format).

**Table**: {table_title}

**Context from document** (may contain Thai Buddhist years like 2567, 2566 OR international years like 2023, 2024):
{context}

**Table HTML**:
{table_html}

Extract detailed information including year.

Return ONLY valid JSON (no markdown, no explanation):
{{
  "table_number": {table_num},
  "year": "2567" or "2023" or "2024" or null (extract from context - can be Thai Buddhist year OR international year),
  "table_type": "balance_sheet" | "profit_loss" | "fixed_assets" | "notes" | "other",
  "contains_depreciation": true or false,
  "depreciation_amount": number or null (total ค่าเสื่อมราคา if present),
  "ebit_amount": number or null,
  "key_line_items": {{
    "item_name_in_original_language": amount,
    "example": 6704482.16
  }},
  "confidence": "high"
}}

Important:
- Look for year in context (can be Thai Buddhist like 2567, 2566 OR international like 2023, 2024, 2022)
- Extract the ACTUAL year from the document, don't convert between formats
- Keep line item names in ORIGINAL language from document (Thai stays Thai, English stays English)
- DO NOT translate line item names - use exact text from the financial statement
- For fixed_assets tables, extract total depreciation (ค่าเสื่อมราคา or Depreciation)
- Extract key financial amounts
"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2000
            )

            # Extract JSON from response
            content = response.content[0].text.strip()

            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:]
                content = content.strip()

            result = json.loads(content)

            print(f"   ✅ Year: {result.get('year', 'N/A')}, Type: {result.get('table_type')}")

            return result

        except Exception as e:
            print(f"   ❌ Error in context analysis: {e}")
            return {
                "table_number": table_num,
                "year": None,
                "table_type": "other",
                "contains_depreciation": False,
                "confidence": "low",
                "error": str(e)
            }

    def save_analysis(self, results: List[Dict], output_path: str = None) -> str:
        """
        Save analysis results to JSON file.

        Args:
            results: List of analysis results
            output_path: Optional output path (default: ai_analysis.json in output_dir)

        Returns:
            Path to saved file
        """
        try:
            if output_path is None:
                output_path = self.output_dir / "ai_analysis.json"
            else:
                output_path = Path(output_path)

            print(f"\n💾 Saving {len(results)} analysis results to: {output_path}")

            # Ensure directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

            # Verify file was written
            if output_path.exists():
                file_size = output_path.stat().st_size
                print(f"   ✅ File saved successfully ({file_size:,} bytes)")
            else:
                print(f"   ❌ ERROR: File was not created!")

        except Exception as e:
            print(f"   ❌ ERROR saving analysis: {e}")
            import traceback
            traceback.print_exc()
            raise
        return str(output_path)

    def print_summary(self, results: List[Dict]):
        """Print analysis summary."""
        print("\n" + "="*60)
        print("📊 ANALYSIS SUMMARY")
        print("="*60)

        for result in results:
            table_num = result.get('table_number', '?')
            table_type = result.get('table_type', 'unknown')
            year = result.get('year', 'N/A')
            has_dep = result.get('contains_depreciation', False)
            dep_amount = result.get('depreciation_amount')

            print(f"\n🔹 Table {table_num}: {table_type.upper()}")
            print(f"   Year: {year}")

            if has_dep and dep_amount:
                print(f"   Depreciation: {dep_amount:,.2f}")

        print("\n" + "="*60)


def analyze_directory(output_dir: str, save: bool = True) -> List[Dict]:
    """
    Convenience function to analyze a directory.

    Args:
        output_dir: Path to output directory with tables.html
        save: Whether to save results to JSON

    Returns:
        List of analysis results
    """
    analyzer = HybridTableAnalyzer(output_dir)
    results = analyzer.analyze_all_tables()

    if save:
        analyzer.save_analysis(results)

    analyzer.print_summary(results)

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: uv run python ai_table_analyzer.py <output_dir>")
        print("Example: uv run python ai_table_analyzer.py 'output/งบการเงิน 2567'")
        sys.exit(1)

    output_dir = sys.argv[1]

    print(f"🚀 Starting Hybrid AI Table Analysis")
    print(f"📁 Output directory: {output_dir}")

    results = analyze_directory(output_dir, save=True)

    print(f"\n✅ Analysis complete!")
    print(f"📊 Analyzed {len(results)} tables")
    print(f"💾 Results saved to ai_analysis.json")
