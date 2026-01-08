# PDF Backend Service

This is a backend service for PDF manipulation, providing an API to split, compress, and extract text from PDF files. Built with Node.js, Express, and TypeScript.

## Features

*   **Split PDF**: Extract specific page ranges from a PDF.
*   **Compress PDF**: Optimize PDF file size using Ghostscript (supports "Aggressive" and "Text Only" modes).
*   **Extract Text**: Parse and extract all text content from a PDF file into a `.txt` file.

## Prerequisites

*   **Node.js** (v18 or higher recommended)
*   **Ghostscript**: Required for the compression feature.
    *   *Ubuntu/Debian*: `sudo apt-get install ghostscript`
    *   *MacOS*: `brew install ghostscript`
    *   *Windows*: Download and install from the official website.

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

## Running the Application

*   **Development Mode**:
    ```bash
    npm run dev
    ```
    The server typically starts on port defined in `src/server.ts` (e.g., 3000).

*   **Production Build**:
    ```bash
    npm run build
    npm start
    ```

## Testing

Run the integration tests using:
```bash
npm test
```

## API Documentation

### 1. Split PDF

Extracts a range of pages from an uploaded PDF.

*   **Endpoint**: `POST /split`
*   **Content-Type**: `multipart/form-data`
*   **Body Parameters**:
    *   `file`: The PDF file to split.
    *   `start`: Start page number (1-based).
    *   `end`: End page number (1-based).
*   **Response**: A binary PDF file containing the extracted pages.

**Example (cURL)**:
```bash
curl -X POST http://localhost:3000/split \
  -F "file=@/path/to/document.pdf" \
  -F "start=1" \
  -F "end=5" \
  --output split_document.pdf
```

### 2. Compress PDF

Compresses the uploaded PDF file.

*   **Endpoint**: `POST /compress`
*   **Content-Type**: `multipart/form-data`
*   **Body Parameters**:
    *   `file`: The PDF file to compress.
    *   `removeImages`: (Optional) "true" to remove all images (Text Only mode), "false" (default) for standard optimization.
*   **Response**: A compressed binary PDF file.

**Example (cURL)**:
```bash
curl -X POST http://localhost:3000/compress \
  -F "file=@/path/to/large_document.pdf" \
  -F "removeImages=false" \
  --output compressed_document.pdf
```

### 3. Extract Text

Extracts all text content from the PDF.

*   **Endpoint**: `POST /extract-text`
*   **Content-Type**: `multipart/form-data`
*   **Body Parameters**:
    *   `file`: The PDF file to parse.
*   **Response**: A plain text file (`.txt`) containing the extracted content.

**Example (cURL)**:
```bash
curl -X POST http://localhost:3000/extract-text \
  -F "file=@/path/to/document.pdf" \
  --output document_text.txt
```

## Use Cases

*   **Reducing Storage Costs**: Use the `/compress` endpoint to shrink large scanned documents before archiving.
*   **Document Processing**: Use `/extract-text` to convert PDF content into plain text for indexing, searching, or feeding into LLMs.
*   **Page Extraction**: Use `/split` to separate a large report into individual chapters or remove unwanted pages.
