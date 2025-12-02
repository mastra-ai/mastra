'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var reactDomShim = require('@storybook/react-dom-shim');
var blocks = require('@storybook/addon-docs/blocks');
var csf = require('storybook/internal/csf');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

var __defProp=Object.defineProperty;var __getOwnPropNames=Object.getOwnPropertyNames;var __esm=(fn,res)=>function(){return fn&&(res=(0, fn[__getOwnPropNames(fn)[0]])(fn=0)),res};var __export=(target,all)=>{for(var name in all)__defProp(target,name,{get:all[name],enumerable:!0});};var DocsRenderer_exports={};__export(DocsRenderer_exports,{DocsRenderer:()=>exports.DocsRenderer,defaultComponents:()=>defaultComponents});var defaultComponents,ErrorBoundary;exports.DocsRenderer = void 0;var init_DocsRenderer=__esm({"src/DocsRenderer.tsx"(){defaultComponents={code:blocks.CodeOrSourceMdx,a:blocks.AnchorMdx,...blocks.HeadersMdx},ErrorBoundary=class extends React.Component{constructor(){super(...arguments);this.state={hasError:!1};}static getDerivedStateFromError(){return {hasError:!0}}componentDidCatch(err){let{showException}=this.props;showException(err);}render(){let{hasError}=this.state,{children}=this.props;return hasError?null:React__default.default.createElement(React__default.default.Fragment,null,children)}},exports.DocsRenderer=class{constructor(){this.render=async(context,docsParameter,element)=>{let components={...defaultComponents,...docsParameter?.components},TDocs=blocks.Docs;return new Promise((resolve,reject)=>{import('@mdx-js/react').then(({MDXProvider})=>reactDomShim.renderElement(React__default.default.createElement(ErrorBoundary,{showException:reject,key:Math.random()},React__default.default.createElement(MDXProvider,{components},React__default.default.createElement(TDocs,{context,docsParameter}))),element)).then(()=>resolve());})},this.unmount=element=>{reactDomShim.unmountElement(element);};}};}});var preview_exports={};__export(preview_exports,{parameters:()=>parameters});var excludeTags=Object.entries(globalThis.TAGS_OPTIONS??{}).reduce((acc,entry)=>{let[tag,option]=entry;return option.excludeFromDocsStories&&(acc[tag]=!0),acc},{}),parameters={docs:{renderer:async()=>{let{DocsRenderer:DocsRenderer2}=await Promise.resolve().then(()=>(init_DocsRenderer(),DocsRenderer_exports));return new DocsRenderer2},stories:{filter:story=>(story.tags||[]).filter(tag=>excludeTags[tag]).length===0&&!story.parameters.docs?.disable}}};init_DocsRenderer();var index_default=()=>csf.definePreviewAddon(preview_exports);

exports.default = index_default;
