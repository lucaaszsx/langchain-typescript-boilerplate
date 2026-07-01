import { Env } from '../config.js';
import chalk from 'chalk';

enum LogLevel {
    Log = 'log',
    Info = 'info',
    Error = 'error',
    Debug = 'debug'
}

const unshiftInfo = (info: string, messages: unknown[]): unknown[] => {
    const newMessages = [...messages];

    if (newMessages.length > 0 && typeof newMessages[0] === 'string')
        newMessages[0] = `${info} ${newMessages[0]}`;
    else newMessages.unshift(info);

    return newMessages;
};

export const logger = {
    logWithTimestamp(level: LogLevel, ...messages: unknown[]): void {
        const timestamp = chalk.blue(`[${new Date().toISOString()}]`);

        if (level in console) console[level](...unshiftInfo(timestamp, messages));
        else
            throw new Error(
                `unexpected log level "${level}". console object doesn't have that method`
            );
    },

    log(...messages: unknown[]): void {
        console.log(...messages);
    },

    info(...messages: unknown[]): void {
        this.logWithTimestamp(LogLevel.Info, ...unshiftInfo(chalk.yellow('[info]'), messages));
    },

    error(...messages: unknown[]): void {
        this.logWithTimestamp(LogLevel.Error, ...unshiftInfo(chalk.red('[error]'), messages));
    },

    debug(...messages: unknown[]): void {
        if (!Env.verbose) return;
        this.logWithTimestamp(
            LogLevel.Debug,
            ...unshiftInfo(chalk.blueBright('[debug]'), messages)
        );
    },

    debugTool(toolName: string, ...messages: unknown[]): void {
        this.debug(...unshiftInfo(chalk.green(`[tool:${toolName}]`), messages));
    }
};
