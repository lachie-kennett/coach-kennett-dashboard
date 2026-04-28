import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['react-markdown', 'remark', 'remark-parse', 'unified', 'bail', 'is-plain-obj', 'trough', 'vfile', 'vfile-message', 'unist-util-stringify-position', 'mdast-util-from-markdown', 'mdast-util-to-string', 'micromark', 'decode-named-character-reference', 'character-entities', 'remark-rehype', 'mdast-util-to-hast', 'trim-lines', 'unist-util-is', 'unist-util-visit', 'unist-util-visit-parents', 'unist-util-position', 'rehype-raw', 'hast-util-raw', 'hast-util-from-parse5', 'hast-util-to-parse5', 'html-void-elements', 'property-information', 'space-separated-tokens', 'comma-separated-tokens', 'zwitch', 'hastscript', 'web-namespaces'],
};

export default nextConfig;
