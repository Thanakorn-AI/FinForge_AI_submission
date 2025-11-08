import { Router } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// System prompt for artifact generation
function getArtifactSystemPrompt(): string {
  return `You are a financial analysis assistant with access to extracted and preprocessed Thai financial PDF data.

**PREPROCESSED DATA LOCATION:**
All financial data is in the \`output/\` directory at the project root. You have FULL file system access via your built-in tools.

**DATA STRUCTURE:**
- \`output/งบการเงิน 2565/\` - Financial statements for 2022 (Thai year 2565)
- \`output/งบการเงิน 2566/\` - Financial statements for 2023 (Thai year 2566)
- \`output/งบการเงิน 2567/\` - Financial statements for 2024 (Thai year 2567)

Each directory contains:
- \`ai_analysis.json\` - Table classifications (balance_sheet, profit_loss, fixed_assets, etc.) with years and metadata
- \`table_N_*.csv\` - Actual table data in CSV format (where N is table number)

**YOUR WORKFLOW:**
1. Use **Bash tool** to list directories: \`ls output/\`
2. Use **Read tool** to read analysis: \`output/งบการเงิน 2565/ai_analysis.json\`
3. Use **Read tool** to read CSV data: \`output/งบการเงิน 2565/table_7_balance_sheet.csv\`
4. Use **Glob tool** to find CSV files: \`output/*/table_*_balance_sheet.csv\`
5. Use the REAL data to create artifacts (NOT templates!)

**THAI YEAR CONVERSION:**
- งบการเงิน 2565 = 2022 (2565 - 543)
- งบการเงิน 2566 = 2023 (2566 - 543)
- งบการเงิน 2567 = 2024 (2567 - 543)

**IMPORTANT:**
- You can read ANY file in the project directory using Read tool
- You can list ANY directory using Bash tool
- You can search for files using Glob tool
- ALWAYS use REAL data from the files, NEVER create placeholder templates

You can create rich artifacts using this format (like Claude.ai):

<antArtifact identifier="unique-id" type="artifact-type" title="Display Title">
  [artifact content here]
</antArtifact>

**Artifact Types:**

1. **application/vnd.ant.code** - HTML, React, JavaScript code
   <antArtifact identifier="chart-viz" type="application/vnd.ant.code" language="html" title="Revenue Chart">
   <!DOCTYPE html>
   <html>...</html>
   </antArtifact>

2. **application/vnd.ant.spreadsheet** - Excel data (JSON format)
   <antArtifact identifier="pl-report" type="application/vnd.ant.spreadsheet" title="P&L Report">
   {
     "sheets": [
       {
         "name": "Profit & Loss",
         "data": [
           ["Item", "2022", "2023", "2024"],
           ["Revenue", 1000000, 1200000, 1500000]
         ]
       }
     ]
   }
   </antArtifact>

3. **application/vnd.ant.chart** - Chart data (for Recharts)
   <antArtifact identifier="revenue-trend" type="application/vnd.ant.chart" title="Revenue Trend">
   {
     "type": "line",
     "data": [...],
     "xAxis": "year",
     "yAxis": "revenue"
   }
   </antArtifact>

4. **text/markdown** - Formatted documents
   <antArtifact identifier="summary" type="text/markdown" title="Financial Summary">
   # Analysis Summary
   ...
   </antArtifact>

**When to Create Artifacts:**
- User requests charts, tables, or visualizations
- Creating substantial code (>15 lines)
- Generating reports or documents
- Self-contained content user might want to edit/download

**Artifact Display Rules:**
- DO NOT write "[Artifact created]" or similar text in your response
- The artifact tags will be automatically detected and displayed
- Simply create the artifact and continue your explanation naturally

**CRITICAL:** Always use REAL data from the tools, not placeholder templates!`;
}

// Streaming chat endpoint with Agent SDK + stdio MCP server
router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  console.log('\n📨 Received message:', message.substring(0, 200));
  console.log('🔗 Session ID:', sessionId || 'new session');

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Get absolute path to output directory
    const projectRoot = path.join(__dirname, '../../../..');
    const outputDir = path.join(projectRoot, 'artifact-app/python-api/output');

    console.log('🤖 Starting Claude Agent with built-in tools');
    console.log('📂 Output directory:', outputDir);

    // Inject absolute path into user's message
    const enrichedMessage = `**IMPORTANT DATA LOCATION:**
The preprocessed financial data is at this ABSOLUTE PATH:
${outputDir}

This directory contains:
- ${outputDir}/งบการเงิน 2565/ (2022 data)
- ${outputDir}/งบการเงิน 2566/ (2023 data)
- ${outputDir}/งบการเงิน 2567/ (2024 data)

Use Read tool with these absolute paths to access the data.

---

**User Request:**
${message}`;

    // Use Agent SDK query() - agent will use built-in Bash/Read/Glob tools
    const response = query({
      prompt: enrichedMessage,
      options: {
        model: 'claude-sonnet-4-20250514',
        systemPrompt: getArtifactSystemPrompt(),
        includePartialMessages: true,  // Enable streaming events
        additionalDirectories: [outputDir],  // Allow access to output directory
        cwd: projectRoot,  // Set working directory to project root
        ...(sessionId && { resume: sessionId })  // Resume session if exists
      }
    });

    // Stream messages to client
    let finalCompleteMessage = '';

    for await (const msg of response) {
      // LOG ALL MESSAGE TYPES
      console.log('📬 Message type:', msg.type);

      // Handle streaming events (token-by-token from Messages API)
      if (msg.type === 'stream_event') {
        const event = (msg as any).event;

        // Handle content_block_delta for streaming text
        if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({
            type: 'text_delta',
            content: event.delta.text,
            partial: true
          })}\n\n`);
        }
      }
      // Handle complete assistant messages - CAPTURE for artifact detection
      else if (msg.type === 'assistant' && (msg as any).message) {
        const message = (msg as any).message;
        const textContent = message.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('');

        // Store complete message for final send
        if (textContent) {
          finalCompleteMessage = textContent;
        }
      }
      // Handle tool progress - LOG what agent is calling!
      else if (msg.type === 'tool_progress') {
        const toolInfo = (msg as any).info;
        console.log('🔧 Agent called tool:', JSON.stringify(toolInfo, null, 2));
        res.write(`data: ${JSON.stringify({
          type: 'tool_use',
          info: toolInfo
        })}\n\n`);
      }
      // Handle system messages (including tool list and session init)
      else if (msg.type === 'system') {
        const systemInfo = (msg as any);
        if (systemInfo.tools) {
          console.log('🛠️  Available tools:', systemInfo.tools);
        }
        // Capture and send session ID to frontend
        if (systemInfo.subtype === 'init' && systemInfo.session_id) {
          console.log('🔗 Sending session ID to frontend:', systemInfo.session_id);
          res.write(`data: ${JSON.stringify({
            type: 'session_init',
            session_id: systemInfo.session_id
          })}\n\n`);
        }
      }
    }

    // Send final complete message with artifact tags
    if (finalCompleteMessage) {
      res.write(`data: ${JSON.stringify({
        type: 'text_complete',
        content: finalCompleteMessage
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('❌ Claude Agent error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: String(error)
    })}\n\n`);
    res.end();
  }
});

export default router;
