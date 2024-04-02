import { experimental_AssistantResponse } from 'ai'
import OpenAI from 'openai'

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge'

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    threadId: string
    message: string
    assistantId: string
  } = await req.json()

  // Create a thread if needed
  const threadId = input.threadId ?? (await openai.beta.threads.create({})).id

  // Add a message to the thread
  const createdMessage = await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: input.message
  })

  return experimental_AssistantResponse(
    { threadId, messageId: createdMessage.id },
    async ({
      forwardStream,
      sendMessage,
      sendDataMessage,
      threadId,
      messageId
    }) => {
      // Run the assistant on the thread
      const runStream = openai.beta.threads.runs.stream(threadId, {
        assistant_id:
          input.assistantId ??
          (() => {
            throw new Error('ASSISTANT_ID is not set')
          })()
      })

      // forward run status would stream message deltas
      let runResult = await forwardStream(runStream)

      // status can be: queued, in_progress, requires_action, cancelling, cancelled, failed, completed, or expired
      // while (
      //   runResult?.status === 'requires_action' &&
      //   runResult.required_action?.type === 'submit_tool_outputs'
      // ) {
      //   const tool_outputs =
      //     runResult.required_action.submit_tool_outputs.tool_calls.map(
      //       (toolCall: any) => {
      //         const parameters = JSON.parse(toolCall.function.arguments)
      //
      //         switch (toolCall.function.name) {
      //           case 'getRoomTemperature': {
      //             const temperature =
      //               homeTemperatures[
      //                 parameters.room as keyof typeof homeTemperatures
      //               ]
      //
      //             return {
      //               tool_call_id: toolCall.id,
      //               output: temperature.toString()
      //             }
      //           }
      //
      //           case 'setRoomTemperature': {
      //             const oldTemperature =
      //               homeTemperatures[
      //                 parameters.room as keyof typeof homeTemperatures
      //               ]
      //
      //             homeTemperatures[
      //               parameters.room as keyof typeof homeTemperatures
      //             ] = parameters.temperature
      //
      //             sendDataMessage({
      //               role: 'data',
      //               data: {
      //                 oldTemperature,
      //                 newTemperature: parameters.temperature,
      //                 description: `Temperature in ${parameters.room} changed from ${oldTemperature} to ${parameters.temperature}`
      //               }
      //             })
      //
      //             return {
      //               tool_call_id: toolCall.id,
      //               output: `temperature set successfully`
      //             }
      //           }
      //
      //           default:
      //             throw new Error(
      //               `Unknown tool call function: ${toolCall.function.name}`
      //             )
      //         }
      //       }
      //     )
      //
      //   runResult = await forwardStream(
      //     openai.beta.threads.runs.submitToolOutputsStream(
      //       threadId,
      //       runResult.id,
      //       { tool_outputs }
      //     )
      //   )
      // }
    }
  )
}
