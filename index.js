#!/usr/bin/env node
const ollama = require('ollama').default;
const readline = require('readline');

const model_options = {
    temperature : 0, // still don't get why > 0 is considered a good idea. Don't confuse creativity with randomness. 
    num_ctx : 128000
}

async function waitForKeyPress() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('line', (input) => {
      resolve(input); // Resolve the promise with user input
      rl.close();     // Close the interface after receiving input
    });
  });
}

// Toolfn
async function bash(command, silent) {
	const { execSync } = require('child_process');
	if (!silent) {
		console.log("> " + command)
		console.log("Execute? Press enter, otherwise Ctrl+C!")
	    const userInput = await waitForKeyPress();
	}
	let result = execSync("bash -c '"+command+"'").toString("utf8");
	if (!silent) console.log(result)
    return result;
}

// From the tool-call example template. (https://github.com/ollama/ollama-js/tree/main/examples/tools)
async function run(model, prompt) {
    // Initialize conversation with a user query
	let sys_info = (await bash("lsb_release -i", true)).replaceAll("\t"," ").replaceAll("\n",". ");
	let sys_prompt = process.env.OLLASH_SYSPROMPT || 'You are a linux shell expert assistant. Don not explain output or reasoning. Make sure you get the message. Only execute tools. ' + sys_info;
	console.log(sys_prompt)
    let messages = [{ role: 'system', content: sys_prompt },
    	            { role: 'user', content: prompt }];

    // First API call: Send the query and function description to the model
    const response = await ollama.chat({
        model: model,
        options : { temperature : 0}, 
        messages: messages,
        tools: [
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
        ],
    })
    // Add the model's response to the conversation history
    messages.push(response.message);
    console.debug(response)
    // Check if the model decided to use the provided function
    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        console.log("The model didn't use the function. Its response was:");
        console.log(response.message.content);
        return;
    }

    // Process function calls made by the model
    if (response.message.tool_calls) {
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
        }
    }
    // Second API call: Get final response from the model
    const finalResponse = await ollama.chat({
        model: model,
        messages: messages,
        options: {temperature: 0}
    });
    console.log(finalResponse.message.content);
    if (finalResponse.message.tool_calls)
    	console.debug(finalResponse)
}

async function main() {	
	await run(process.env.OLLASH_MODEL || 'mistral-nemo',process.argv.slice(2).join(" ")).catch(error => console.error("An error occurred:", error));
}

main(); 
