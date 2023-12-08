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
  demandOption: true,
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

// Parse the file content to AST
let ast;
try {
  ast = parse(fileContent, {
    sourceType: "module",
    plugins: ["jsx"], // If you are using JSX
    //errorRecovery: true,
    //allowAwaitOutsideFunction: true,
    //allowReturnOutsideFunction: true,
    //allowUndeclaredExports: true,
  });
} catch (err) {
  if (err.code === "BABEL_PARSER_SYNTAX_ERROR") {
    console.error(`Syntax error in file: ${filePath}`);
    console.error(`Error message: ${err.message}`);

    const lines = fileContent.split("\n");
    const errorLine = err.loc.line;

    if (lines.length >= errorLine) {
      console.error(`Problematic line (${errorLine}): ${lines[errorLine - 1]}`);
    } else {
      console.error(`Could not locate the problematic line.`);
    }
  } else {
    console.error(err);
  }
  process.exit(1);
}

const handleNode = (node) => {
  //console.log(node);
  const { start, end } = node;
  const codeSnippet = fileContent.slice(start, end);
  console.log(codeSnippet, "\n");

};

// Traverse the AST
traverse(ast, {
  enter(path) {
    if (path.isFunctionDeclaration() || path.isArrowFunctionExpression() || path.isClassDeclaration()) {
      handleNode(path.node);
    }
  }
});
