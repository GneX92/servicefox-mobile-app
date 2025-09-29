declare module '*.svg' {
  import * as React from 'react';
    import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps & { title?: string }>;
  export default content;
}
