export const showError = function(error) {
  if (typeof error === 'object') {
    error = '未知错误';
  }
  this.setState({
    ...this.state,
    error: error ? error : ''
  });
}