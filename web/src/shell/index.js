import React from 'react';
import Header from './components/header';
import Content from './components/content';
import Footer from './components/footer';

export default function Shell(){
  return (
    <div>
      <Header />
      <Content />
      <Footer />
    </div>
  );
}