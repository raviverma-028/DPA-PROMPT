/** Error with an HTTP status that is safe to show to the client. */
class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
module.exports = { AppError };
