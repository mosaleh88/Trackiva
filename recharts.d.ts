// This declaration file is a workaround for the missing type definitions
// for the 'recharts/lib' deep import path. By declaring the module,
// we are telling TypeScript to treat it as a valid module, which
// resolves the TS7016 build error.
declare module 'recharts/lib';
declare module 'recharts';
