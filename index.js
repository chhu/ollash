#!/usr/bin/env node

// Best models as of 08-2024: mistral-large q8 and firefunctionv2 q8.

const OLLASH_API = process.env.OLLASH_API || 'http://127.0.0.1:11434';
const OLLASH_MODEL = process.env.OLLASH_MODEL || 'mistral-nemo';
const OLLASH_SYSPROMPT = process.env.OLLASH_SYSPROMPT || 
    'You are a linux shell expert assistant. Don not explain output or reasoning. Make sure you get the message. The user will see the output of the command as well. You can make more than one tool call. You do not have sudo rights!';
const OLLASH_NUM_CONTEXT = Number(process.env.OLLASH_NUM_CONTEXT) || 32000; // although higher is better, big mem reqs

const ollama = new (require('ollama').Ollama)({ host: OLLASH_API });
const readline = require('readline');

const model_options = {
    temperature : 0, // still don't get why > 0 is considered a good idea. Don't confuse creativity with randomness. 
    num_ctx : OLLASH_NUM_CONTEXT,
}

const model_tools = [
            {
                type: 'function',
                function: {
                    name: 'execute_bash',
                    description: 'Execute a bash command',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: {
                                type: 'string',
                                description: 'The command to be executed',
                            },
                        },
                        required: ['command'],
                    },
                },
            },
        ];


async function waitForKeyPress() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    rl.on('line', (input) => {
      resolve(input); // Resolve the promise with user input
      rl.close();     // Close the interface after receiving input
    });
  });
}

// Toolfn
async function bash(command, silent) {
	const { execFileSync } = require('child_process');
	if (!silent) {
		console.log("> " + command)
		console.log("Execute? Press enter, Press N + enter to deny to model or Ctrl+C to end!")
	    const userInput = await waitForKeyPress();
        if (userInput.startsWith("N"))
            return "Access denied.";//"The user denied the execution of the tool command. Improve on the next try."
	}
	let result = "";
	try {
	    result = execFileSync("/bin/bash",["-c", command.toString("utf8")]/*, { maxBuffer: 1024*1024*6}*/).toString("utf8");
	} catch (e) {result += e.toString("utf8")}
	if (!silent) console.log(result)
    return result;
}

// From the tool-call example template. (https://github.com/ollama/ollama-js/tree/main/examples/tools)
async function run(model, prompt) {
    // Initialize conversation with a user query
	let sys_info = (await bash("lsb_release -i", true)).replaceAll("\t"," ").replaceAll("\n",". ");
	let sys_prompt = OLLASH_SYSPROMPT + " " + sys_info;
	console.log("Querying " + model + "..." );

    let messages = [{ role: 'system', content: sys_prompt },
    	            { role: 'user', content: prompt }];

    // First API call: Send the query and function description to the model
    let response = await ollama.chat({
        model: model,
        options : model_options, 
        messages: messages,
        tools: model_tools
    })
    // Add the model's response to the conversation history
    messages.push(response.message);

    // Process function calls made by the model
    while (response.message.tool_calls) {
        const availableFunctions = {
            execute_bash: bash,
        };
        for (const tool of response.message.tool_calls) {
            const functionToCall = availableFunctions[tool.function.name];
            const functionResponse = await functionToCall(tool.function.arguments.command);
        	// Add function response to the conversation
        	messages.push({
            	    role: 'tool',
            	    content: functionResponse,
        	});
            if (functionResponse == "Access denied.") 
        	messages.push({
            	    role: 'user',
            	    content: "This is not the expected function call and it was not executed. Please improve. Do not repeat the last tool call!",
        	})
        }
	if (messages.slice(-1).role != "user")
            messages.push({
	        role: 'user', // for some models "system" works better here...
    	        content: "Did everything go as planned? If so give a short answer to my first question and end the chat session, otherwise refine the tool call and try again."
    	    });
    // Second API call: Get final response from the model
    	console.log("Querying " + model + "...");
	    response = await ollama.chat({
	        model: model,
            messages: messages,
	        options: model_options,
    	    tools: model_tools,
//    	    stream: true  // not working with tools 
    	});
//    	for await (const part of response)
//	        process.stdout.write(part.message.content);
    	messages.push(response.message);
    };
    console.log(response.message.content);
}

async function main() {	
	await run(OLLASH_MODEL, process.argv.slice(2).join(" ")).catch(error => console.error("An error occurred:", error));
}

main(); 
