import ReactNamespace from 'react/index';
import ReactDomNamespace from 'react-dom';

const React = (eval("window") as Window & typeof globalThis).React as typeof ReactNamespace;
const ReactDOM = (eval("window") as Window & typeof globalThis).ReactDOM as typeof ReactDomNamespace;

export default React;
export {
  ReactDOM
}