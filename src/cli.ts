import { createInterface } from 'node:readline';
import { AssistantAgent } from './agent/index.js';
import { HumanMessage } from 'langchain';
import { randomUUID } from 'node:crypto';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const isQuitCommand = (prompt: unknown) => prompt === '/quit' || prompt === '/q';
const askQuestion = (question: string) => {
    return new Promise((resolve, _reject) => {
        rl.question(question, (response) => resolve(response.trim()));
    });
};

const assistant = new AssistantAgent();
const config = { thread_id: randomUUID() };

async function main() {
    let prompt;
    await assistant.start();

    do {
        prompt = await askQuestion('You: ');
        if (isQuitCommand(prompt)) break;

        const response = await assistant.agent?.invoke(
            {
                messages: [new HumanMessage(prompt as string)]
            },
            { configurable: config }
        );
        const lastMessage = response?.messages.at(-1);
        console.log({ response });
        if (lastMessage && lastMessage.content) {
            console.log(`Agent: ${lastMessage.content}\n`);
        } else {
            console.log("The agent didn't respond with any text.\n");
        }
    } while (!isQuitCommand(prompt));

    rl.close();
}

main();
