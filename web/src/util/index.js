export const showError=function(error){
  this.setState({
    ...this.state,
    error:error?error:''
  });
}
