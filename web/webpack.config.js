const path=require('path');
const HtmlWebpackPlugin=require('html-webpack-plugin');

let htmlWebpackPlugin=new HtmlWebpackPlugin({
  filename:'index.html',
  template:path.resolve(__dirname,'./src/index.html')
});

module.exports={
  mode:'development',
  devtool:'souce-map',
  entry:'./src/index.js',
  output:{
    path:path.resolve(__dirname,'dist'),
    filename:'bundle.js'
  },
  devServer:{
    historyApiFallback:true,
    contentBase:path.join(__dirname,'dist'),
    compress:true,
    port:3001,
    open:true
  },
  plugins:[htmlWebpackPlugin],
  module:{
    rules:[
      {
        test:/\.js|jsx$/,
        use:'babel-loader',
        exclude:/node_modules/
      },
      {
        test:/\.scss$/,
        use:[
          "style-loader",
          "css-loader",
          "sass-loader"
        ]
      }
    ]
  }
}