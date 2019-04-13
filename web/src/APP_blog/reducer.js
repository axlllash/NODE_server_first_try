export default (state={blog:'e'}, action) => {
  switch (action.type) {
    case 'blog':
      {
        return {
          blog: 'lalla',
          ...state
        }
      }
    default:
      {
        return state;
      }
  }
}