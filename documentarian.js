#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const openai = require("openai");

// Optional: const jscodeshift = require('jscodeshift');

openai.apiKey = process.env.OPENAI_API_KEY;


// Parse the command line arguments
const argv = yargs(hideBin(process.argv)).option('file', {
  alias: 'f',
  describe: 'Path to the JavaScript file',
  type: 'string',
  demandOption: true, // This option is required
}).argv;

// Retrieve the file path from the argument
const filePath = argv.file;

// Check if the file exists before reading it
if (!fs.existsSync(filePath)) {
  console.error(`The file "${filePath}" does not exist.`);
  process.exit(1);
}

let fileContent;
try {
  // Read the content of the provided file
  fileContent = fs.readFileSync(filePath, 'utf-8');
} catch (err) {
  console.error(`An error occurred while reading the file: ${err.message}`);
  process.exit(1);
}

console.log(fileContent);

// Parse the file content to AST
const ast = parse(fileContent, {
  sourceType: 'module',
  plugins: ['jsx'] // If you are using JSX
});


/*
// Traverse the AST
traverse(ast, {
  enter(path) {
    if (path.isFunctionDeclaration() || path.isArrowFunctionExpression() || path.isClassDeclaration()) {
      handleNode(path.node);
    }
  }
});
*/

/*
// Define handleNode function to extract code snippets
const handleNode = (node) => {
  // Extract code snippet logic goes here
  // For example, get the code of the entire function or class
};
*/