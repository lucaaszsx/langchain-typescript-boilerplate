import { AssistantAgent } from './agent/index.js';
import { logger } from './services/logger.js';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import chalk from 'chalk';

const MESSAGE_PLACEHOLDER = 'Type your message, or /bye to exit';
const ask = async () => {
    let value = '';

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    const render = () => {
        process.stdout.write('\r');
        process.stdout.write('\x1b[2K');
        process.stdout.write(chalk.yellow('You: '));

        if (value.length === 0) {
            process.stdout.write('\x1b[90m');
            process.stdout.write(MESSAGE_PLACEHOLDER);
            process.stdout.write('\x1b[0m');
            process.stdout.write(`\x1b[${MESSAGE_PLACEHOLDER.length}D`);
        } else process.stdout.write(value);
    };
    render();

    return new Promise<string>((resolve) => {
        const onKeypress = (str: string, key: readline.Key) => {
            if (key.ctrl && key.name === 'c') {
                cleanup();
                process.exit();
            }

            if (key.name === 'return') {
                if (value) {
                    process.stdout.write('\n');
                    cleanup();
                    resolve(value);
                }
                return;
            }

            if (key.name === 'backspace') {
                value = value.slice(0, -1);
                render();
                return;
            }

            if (str && !key.ctrl && !key.meta) {
                value += str;
                render();
            }
        };

        const cleanup = () => {
            process.stdin.off('keypress', onKeypress);
            process.stdin.setRawMode(false);
            process.stdin.pause();
        };

        process.stdin.on('keypress', onKeypress);
    });
};
const isQuitCommand = (prompt: string) => prompt.toLowerCase().split(' ').at(0) === '/bye';

async function main() {
    const agent = new AssistantAgent();

    try {
        await agent.init();
    } catch (error) {
        logger.error(
            'failed to initialize agent:\n',
            error instanceof Error ? error.stack : String(error)
        );
        process.exit(1);
    }

    const threadId = randomUUID();
    logger.debug('using "%s" as thread id', threadId);

    let prompt: string | null;
    let quit = false;

    while (!quit) {
        prompt = await ask();

        if (!prompt) continue;
        if (isQuitCommand(prompt)) {
            logger.info('exiting...');
            // eslint-disable-next-line no-useless-assignment
            quit = true;
            break;
        }

        try {
            const response = await agent.invoke(threadId, prompt);
            const lastMessage = response.messages.at(-1);

            if (lastMessage && typeof lastMessage.content === 'string')
                logger.log(chalk.blue('Agent:'), lastMessage.content);
            else logger.info("Agent didn't respond with a textual message.");
        } catch (error) {
            logger.error(
                'Agent failed to respond:',
                error instanceof Error ? error.message : String(error)
            );
        }

        process.stdout.write('\n');
    }
}

void main();
