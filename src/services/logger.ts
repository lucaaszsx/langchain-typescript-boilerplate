import { Env } from '../config.js';
import chalk from 'chalk';

const unshiftInfo = (info: string, messages: unknown[]): unknown[] => {
    if (messages.length > 0 && typeof messages[0] === 'string')
        messages[0] = `${info} ${messages[0]}`;
    else messages.unshift(info);

    return messages;
};

export const logger = {
    debug(...messages: unknown[]): void {
        if (!Env.verbose) return;

        const timestamp = chalk.magenta(`[${new Date().toISOString()}]`);
        console.debug(...unshiftInfo(timestamp, messages));
    },

    debugTool(toolName: string, ...messages: unknown[]): void {
        this.debug(...unshiftInfo(chalk.yellow(`[tool:${toolName}]`), messages));
    }
};
