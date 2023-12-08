#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { default: generate } = require("@babel/generator");
const OpenAI = require("openai");

const openai = new OpenAI({});

const argv = yargs(hideBin(process.argv))
  .option("file", {
    alias: "f",
    describe: "Path to the JavaScript file",
    type: "string",
    demandOption: true,
  })
  .option("clear-comments", {
    alias: "c",
    describe: "Remove all comments from the file before processing",
    type: "boolean",
    default: false,
  })
  .option("openai-comments", {
    alias: "o",
    describe: "Fetch and add comments from OpenAI",
    type: "boolean",
    default: false,
  }).argv;

const filePath = argv.file;

if (!fs.existsSync(filePath)) {
  console.error(`The file "${filePath}" does not exist.`);
  process.exit(1);
}

let cleanup_fileContent;
try {
  cleanup_fileContent = fs.readFileSync(filePath, "utf-8");
} catch (err) {
  console.error(`An error occurred while reading the file: ${err.message}`);
  process.exit(1);
}

let cleanup_ast = parse(cleanup_fileContent, {
  sourceType: "module",
  plugins: ["jsx"],
});

// Function to remove all comments from AST
function removeComments(cleanup_ast) {
  console.log("removing comments");
  traverse(cleanup_ast, {
    enter(path) {
      if (path.node.leadingComments) {
        //console.log("Leading comments before removal:", path.node.leadingComments);
        path.node.leadingComments = [];
      }
      if (path.node.trailingComments) {
        //console.log("Trailing comments before removal:", path.node.trailingComments);
        path.node.trailingComments = [];
      }
      if (path.node.innerComments) {
        //console.log("Inner comments before removal:", path.node.innerComments);
        path.node.innerComments = [];
      }
    },
  });
  return cleanup_ast;
}

// Remove all comments if the -c argument is provided
if (argv["clear-comments"]) {
  cleanup_ast = removeComments(cleanup_ast);
  cleanup_fileContent = generate(cleanup_ast, {}, cleanup_fileContent).code;
  fs.writeFileSync(filePath, cleanup_fileContent); // Write uncommented code back to the file
}

function printRedDashLine() {
  const line = "-".repeat(80);
  const red = "\x1b[31m";
  const reset = "\x1b[0m";
  console.log(red + line + reset);
}

async function queryOpenAI(snippet, code) {
  prompt = `Take a deep breath and think through everything I ask logically. Check your work.
I am going to show you a file of javascript. The file will begin after this paragraph,
and it will continue until I tell you the whole file is done. After a blank line,
I will include a portion of the same code as before, and I want you to describe what the 
portion of code does, as if you were writing an inline comment for the file. Be brief
when you are able, but also be detailed. The whole file follows:

  ` + code + `

The whole file is above, and the portion of the code repeated below is what I want you
to describe. This portion of the code follows:

  ` + snippet;

  try {
    const params = {
      messages: [{ role: "user", content: prompt + "\n" + code }],
      //model: "gpt-4-1106-preview",
      model: "gpt-3.5-turbo-1106",
    };

    const chatCompletion = await openai.chat.completions.create(params);
    if (chatCompletion?.choices[0]?.message?.content) {
      return chatCompletion.choices[0].message.content;
    } else {
      return {
        topic: "Error: Could not retrieve prompt from OpenAI",
      };
    }
  } catch (err) {
    console.error(`Error querying OpenAI: ${err.message}`);
    return {
      topic: "Error querying OpenAI",
    };
  }
}

let fileContent;
try {
  fileContent = fs.readFileSync(filePath, "utf-8");
} catch (err) {
  console.error(`An error occurred while reading the file: ${err.message}`);
  process.exit(1);
}

let ast = parse(fileContent, {
  sourceType: "module",
  plugins: ["jsx"],
});

const nodesToProcess = [];

// Collect nodes first
traverse(ast, {
  enter(path) {
    if (
      path.isFunctionDeclaration() ||
      path.isArrowFunctionExpression() ||
      path.isClassDeclaration()
    ) {
      nodesToProcess.push(path.node);
    }
  },
});

// Function to insert comments into AST
function insertComment(node, comment) {
  if (comment) {
    node.leadingComments = node.leadingComments || [];
    node.leadingComments.push({
      type: 'CommentBlock',
      value: comment.trim(),
    });
  }
}


// Modify the processNodes function to check for the openai-comments flag
async function processNodes() {
  for (const node of nodesToProcess) {
    const { start, end } = node;
    const codeSnippet = fileContent.slice(start, end);

    if (argv["openai-comments"]) {
      printRedDashLine();
      let comment = await queryOpenAI(codeSnippet, fileContent);
      console.log(comment);
      insertComment(node, comment);
    }
  }

  // Generate the modified code
  if (argv["openai-comments"]) {
    const output = generate(ast, {}, fileContent);
    fs.writeFileSync(filePath, output.code); // Write the modified code back to the file
    console.log("Comments inserted and file updated.");
  }
}

// Run the async function
processNodes().then(() => console.log("Analysis complete."));
