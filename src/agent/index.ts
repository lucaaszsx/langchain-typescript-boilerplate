import { MemorySaver, Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { MessagesPlaceholder, ChatPromptTemplate } from '@langchain/core/prompts';
import { type BaseMessage, type AIMessage, HumanMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AssistantKnowledge } from './knowledge.js';
import { toLocalISOString } from '../util.js';
import { ChatGroq } from '@langchain/groq';
import { Env } from '../config.js';
import tools from '../tools/index.js';

export class AssistantAgent {
    private static readonly Model = 'openai/gpt-oss-120b';
    private static readonly GraphState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
            reducer: (x, y) => x.concat(y)
        })
    });

    private readonly agent: ReturnType<typeof this.compileWorkflow>;
    private readonly knowledge = new AssistantKnowledge();
    private readonly memory = new MemorySaver();
    private readonly model = new ChatGroq({
        model: AssistantAgent.Model,
        apiKey: Env.apiKey
    }).bindTools(tools);
    private readonly promptTemplate: ChatPromptTemplate;

    constructor() {
        this.promptTemplate = ChatPromptTemplate.fromMessages([
            ['system', this.knowledge.getSystemPrompt()],
            new MessagesPlaceholder('messages')
        ]);
        this.agent = this.compileWorkflow();
    }

    public async init(): Promise<this> {
        await this.knowledge.init();
        return this;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public invoke(threadId: string, prompt: string) {
        return this.agent.invoke(
            {messages: [new HumanMessage(prompt)]},
            { configurable: { thread_id: threadId } }
        );
    }

    private async callModel(
        state: typeof AssistantAgent.GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
        const prompt = await this.promptTemplate.formatMessages({
            messages: state.messages,
            currentDate: toLocalISOString(),
            tz: Env.tz
        });
        const response = await this.model.invoke(prompt);

        return { messages: [response] };
    }

    private shouldContinue(state: typeof AssistantAgent.GraphState.State): string {
        const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
        if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0)
            return 'tools';

        return END;
    }

    private compileWorkflow() {
        const workflow = new StateGraph(AssistantAgent.GraphState)
            .addNode('agent', this.callModel.bind(this))
            .addNode('tools', new ToolNode(tools))
            .addEdge(START, 'agent')
            .addConditionalEdges('agent', this.shouldContinue.bind(this))
            .addEdge('tools', 'agent');

        return workflow.compile({ checkpointer: this.memory });
    }
}
