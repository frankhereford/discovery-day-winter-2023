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
  })
  .option("header", {
    alias: "h",
    describe: "Fetch and add a summary header from OpenAI",
    type: "boolean",
    default: false,
  }).argv;

const filePath = argv.file;

if (!fs.existsSync(filePath)) {
  console.error(`The file "${filePath}" does not exist.`);
  process.exit(1);
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

// Function to remove all comments from AST
function removeComments(ast) {
  //console.log("removing comments");
  traverse(ast, {
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
  return ast;
}

// Remove all comments if the -c argument is provided
if (argv["clear-comments"]) {
  ast = removeComments(ast);
  fileContent = generate(ast, {}, fileContent).code;
  fs.writeFileSync(filePath, fileContent); // Write uncommented code back to the file
  ast = parse(fileContent, {
    sourceType: "module",
    plugins: ["jsx"],
  });
}

function printColoredDashLine(color) {
  const line = "-".repeat(80);
  let colorCode;

  switch (color.toLowerCase()) {
    case "red":
      colorCode = "\x1b[31m";
      break;
    case "green":
      colorCode = "\x1b[32m";
      break;
    case "blue":
      colorCode = "\x1b[34m";
      break;
    default:
      colorCode = ""; // Default to no color if an unrecognized color is passed
      break;
  }

  const reset = "\x1b[0m";
  console.log(colorCode + line + reset);
}

async function queryOpenAI(snippet, code) {
  prompt =
    `I am going to show you a file of javascript. The file will begin after this paragraph,
and it will continue until I tell you the whole file is done. After a blank line,
I will include a portion of the same code as before, and I want you to describe what the 
portion of code does, as if you were writing an inline comment for the file. Be as brief as
possible with your comment. One or two sentences maximum. Do not include the '//'. The whole file follows:

  ` +
    code +
    `

The whole file is above, and the portion of the code repeated below is what I want you
to describe. This portion of the code follows:

  ` +
    snippet;

  try {
    const params = {
      messages: [{ role: "user", content: prompt + "\n" + code }],
      //model: "gpt-4-1106-preview",
      model: "gpt-4",
      //model: "gpt-3.5-turbo-1106",
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

try {
  fileContent = fs.readFileSync(filePath, "utf-8");
} catch (err) {
  console.error(`An error occurred while reading the file: ${err.message}`);
  process.exit(1);
}

const nodesToProcess = [];

// Collect nodes first
traverse(ast, {
  enter(path) {
    if (
      // things we want commented
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
      type: "CommentBlock",
      value: comment,
    });
  }
}

function splitTextIntoLines(text, maxLineLength = 80) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + word).length > maxLineLength) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += ` ${word}`;
    }
  });

  // Add the last line if it's not empty
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}

async function queryOpenAISummary(code) {
  const prompt = `Please provide a 200-word summary in markdown$, using bulleted lists where appropriate, of the following JavaScript file content. Don't wrap lines except for new bullets or paragraphs. Here's the file: 

${code}`;

  try {
    const params = {
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4",
    };

    const chatCompletion = await openai.chat.completions.create(params);
    if (chatCompletion?.choices[0]?.message?.content) {
      return chatCompletion.choices[0].message.content;
    } else {
      return "Error: Could not retrieve summary from OpenAI";
    }
  } catch (err) {
    console.error(`Error querying OpenAI: ${err.message}`);
    return "Error querying OpenAI";
  }
}

// Modify the processNodes function to check for the openai-comments flag
async function processNodes() {
  for (const node of nodesToProcess) {
    const { start, end } = node;
    const codeSnippet = fileContent.slice(start, end);

    if (argv["openai-comments"]) {
      printColoredDashLine('red');
      let comment = await queryOpenAI(codeSnippet, fileContent);
      let split_comment = splitTextIntoLines(comment, 80).join("\n");
      console.log(split_comment);
      insertComment(node, split_comment);
    }
  }

  // Generate the modified code
  if (argv["openai-comments"]) {
    const output = generate(ast, {}, fileContent);
    fs.writeFileSync(filePath, output.code); // Write the modified code back to the file
    fileContent = output.code;
  }

  printColoredDashLine('green');

  if (argv["header"]) {
    let summary = await queryOpenAISummary(fileContent);
    summary = splitTextIntoLines(summary, 120).join("\n");
    fileContent = `/*\n${summary}\n*/\n\n${fileContent}`;
    fs.writeFileSync(filePath, fileContent); // Write the file with the prepended summary
    console.log("Summary header inserted and file updated.");
    console.log(summary);
    printColoredDashLine('blue');
  }
}

// Run the async function
processNodes().then(() => console.log("Analysis complete."));
