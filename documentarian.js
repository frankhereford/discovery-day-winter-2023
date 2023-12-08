#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
//import OpenAI from "openai";
const OpenAI = require("openai");




const openai = new OpenAI({});
//const openai = new OpenAI({ });

// Optional: const jscodeshift = require('jscodeshift');

//openai.apiKey = process.env.OPENAI_API_KEY;


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

function printRedDashLine() {
  const line = '-'.repeat(80);
  const red = '\x1b[31m'; // ANSI code for red
  const reset = '\x1b[0m'; // ANSI code to reset color

  console.log(red + line + reset);
}

async function queryOpenAI(prompt, code) {
    const params = {
    messages: [{ role: "user", content: prompt + "\n" + code }],
    //model: "gpt-4",
    model: 'gpt-3.5-turbo',
    };

  
    const chatCompletion = await openai.chat.completions.create(params);
    if (chatCompletion?.choices[0]?.message?.content) {
    const topicObj = JSON.parse(chatCompletion.choices[0].message.content)
    return {
        label: topicObj.label,
        topic: topicObj.topic,
    };
    } else {
    return {
        topic: 'Error: Could not retrieve prompt from OpenAI',
    };
    }


}


const handleNode = async (node) => {
  printRedDashLine();
  //console.log(node);
  const { start, end } = node;
  const codeSnippet = fileContent.slice(start, end);
  console.log(codeSnippet, "\n");
  let response = await queryOpenAI("What does this code do?", codeSnippet);
  console.log(response)
};

// Traverse the AST
traverse(ast, {
  enter(path) {
    if (path.isFunctionDeclaration() || path.isArrowFunctionExpression() || path.isClassDeclaration()) {
      handleNode(path.node);
    }
  }
});
