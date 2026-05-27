export type OperationRequest = {
  type: "operation_request"
  callId: string
  artifact: string
  operation: string
  args: Record<string, unknown>
}

export type SignalMessage = {
  type: "signal"
  callId: string
  name: string
  args: unknown[]
}

export type ObservablePropertyMessage = {
  type: "observable_property"
  callId: string
  name: string
  args: unknown[]
}

export type ClearObservablePropertiesMessage = {
  type: "clear_observable_properties"
  callId: string
  name: string
}

export type DoneMessage = {
  type: "done"
  callId: string
}

export type ErrorMessage = {
  type: "error"
  callId: string
  code: string
  message: string
}

export type IncomingMessage = OperationRequest

export type OutgoingMessage =
  | SignalMessage
  | ObservablePropertyMessage
  | ClearObservablePropertiesMessage
  | DoneMessage
  | ErrorMessage