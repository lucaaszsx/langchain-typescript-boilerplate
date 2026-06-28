import { MemorySaver, Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { MessagesPlaceholder, ChatPromptTemplate } from '@langchain/core/prompts';
import { KNOWLEDGE_SYSTEM_PROMPT, readKnowledge } from '../util/knowledge.js';
import type { BaseMessage, AIMessage } from '@langchain/core/messages';
import { SystemMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AssistantTools } from './tools.js';
import { ChatGroq } from '@langchain/groq';
import { Env } from '../config.js';

export class AssistantAgent {
    public static readonly Model = 'openai/gpt-oss-120b';
    private static readonly GraphState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
            reducer: (x, y) => x.concat(y)
        })
    })

    public agent: ReturnType<typeof this.compileWorkflow> | null = null;
    private readonly memory = new MemorySaver();
    private readonly model = new ChatGroq({
        model: AssistantAgent.Model,
        apiKey: Env.apiKey
    }).bindTools(AssistantTools);
    private promptTemplate: ChatPromptTemplate | null = null;

    public async start(): Promise<this> {
        const knowledge = await readKnowledge(KNOWLEDGE_SYSTEM_PROMPT);

        this.promptTemplate = ChatPromptTemplate.fromMessages([
            new SystemMessage(knowledge.content),
            new MessagesPlaceholder('messages')
        ]);
        this.agent = this.compileWorkflow();

        return this;
    }

    private async callModel(state: typeof AssistantAgent.GraphState.State): Promise<{ messages: BaseMessage[] }> {
        const prompt = await this.promptTemplate!.formatMessages({ messages: state.messages });
        const response = await this.model.invoke(prompt);
        return { messages: [response] };
    }

    private shouldContinue(state: typeof AssistantAgent.GraphState.State): string {
        const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
        if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return 'tools';

        return END;
    }

    private compileWorkflow() {
        const workflow = new StateGraph(AssistantAgent.GraphState)
            .addNode('agent', this.callModel.bind(this))
            .addNode('tools', new ToolNode(AssistantTools))
            .addEdge(START, 'agent')
            .addConditionalEdges('agent', this.shouldContinue.bind(this))
            .addEdge('tools', 'agent');

        return workflow.compile({ checkpointer: this.memory });
    }
}