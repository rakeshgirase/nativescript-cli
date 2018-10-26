/**
 * Defines messages used in communication between CLI's process and analytics subprocesses.
 */
const enum AnalyticsMessages {
	/**
	 * Analytics Broker is initialized and is ready to receive information for tracking.
	 */
	BrokerReadyToReceive = "BrokerReadyToReceive",

	/**
	 * Eqatec Analytics process is initialized and is ready to receive information for tracking.
	 */
	EqatecAnalyticsReadyToReceive = "EqatecAnalyticsReadyToReceive"
}

/**
 * Defines the type of the messages that should be written in the local analyitcs log file (in case such is specified).
 */
const enum AnalyticsLoggingMessageType {
	/**
	 * Information message. This is the default value in case type is not specified.
	 */
	Info = "Info",

	/**
	 * Error message - used to indicate that some action while trying to track information did not succeeded.
	 */
	Error = "Error"
}
