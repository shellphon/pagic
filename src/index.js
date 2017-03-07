/* eslint no-console:0 */

const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const findParentDir = require('find-parent-dir');

const processors = [
  require('./processor/parseFrontMatter'),
  require('./processor/parseMarkdown'),
  require('./processor/injectRelativeToRoot'),
];

const LAYOUT_FILENAME = '_layout.js';
const DEFAULT_OPTIONS = {
  srcDir: 'src',
  distDir: 'public',
};

class Pagic {
  constructor(options = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);

    if (typeof this.options.srcDir === 'undefined' || this.options.srcDir === null) {
      this.options.srcDir = DEFAULT_OPTIONS.srcDir;
    }
    if (typeof this.options.distDir === 'undefined' || this.options.distDir === null) {
      this.options.distDir = DEFAULT_OPTIONS.distDir;
    }
  }

  build() {
    this.clearDistDir();
    this.buildMD();
    this.copyStaticFiles();
  }

  clearDistDir() {
    fse.emptyDirSync(this.options.distDir);
  }

  buildMD() {
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.options.srcDir,
    });

    if (mdFiles.length === 0) {
      console.log('No markdown files found');
      return;
    }

    mdFiles.forEach(filePath => {
      const resolvedFilePath = path.resolve(this.options.srcDir, filePath);
      const resolvedDistPath = path.resolve(this.options.distDir, filePath)
        .replace(/\.md$/, '.html');

      const layout = this.getLayout(resolvedFilePath);

      if (!layout) {
        console.error(`CANNOT find a layout for ${resolvedFilePath}, will skip this file`);
        return;
      }

      const originalContent = fse.readFileSync(resolvedFilePath, 'utf-8');
      
      const startTime = new Date();

      const context = processors.reduce((prevContext, processor) => processor(prevContext), {
        path: filePath,
        content: originalContent,
        options: this.options,
      });

      const html = layout(context);

      fse.outputFileSync(resolvedDistPath, html);

      const endTime = new Date();

      console.log(`Generated ${resolvedDistPath} ......`+(endTime.getTime()-startTime.getTime())+'ms');
    });
  }

  addMd(filePath){
    filePath = path.relative(this.options.srcDir, filePath);
    this.buildMDFiles([filePath]);
  }

  buildMDByAdd(layoutPath, needFresh){
    layoutPath = path.relative(this.options.srcDir, layoutPath);
    const srcDir = path.resolve(this.options.srcDir, path.dirname(layoutPath));
    const distDir = path.resolve(this.options.distDir, path.dirname(layoutPath));

    let mdFiles = glob.sync('**/*.md', {
      cwd: srcDir
    });
    if(needFresh){
      this.refreshCache(path.resolve(srcDir, LAYOUT_FILENAME));
    }

    //filter sub has layout files
    //console.log(srcDir);
    mdFiles = mdFiles.filter(filePath => {
      filePath = path.resolve(srcDir, filePath);
      const fileDir = path.dirname(filePath);
     // console.log(path.dirname(srcDir), fileDir);
      //base md file should stay
      if(srcDir===fileDir) return true;

      const lydir = findParentDir.sync(filePath, LAYOUT_FILENAME);
     // console.log(lydir, path.dirname(lydir));
      if(lydir===fileDir+path.sep){
        return false
      }
      return true;
    });

    if (mdFiles.length === 0) {
      console.log('No markdown files found');
      return;
    }

    mdFiles.forEach(filePath => {
      const resolvedFilePath = path.resolve(srcDir, filePath);
      const resolvedDistPath = path.resolve(distDir, filePath)
        .replace(/\.md$/, '.html');

      const layout = this.getLayout(resolvedFilePath);

      if (!layout) {
        console.error(`CANNOT find a layout for ${resolvedFilePath}, will skip this file`);
        return;
      }

      const originalContent = fse.readFileSync(resolvedFilePath, 'utf-8');
      
      const startTime = new Date();

      const context = processors.reduce((prevContext, processor) => processor(prevContext), {
        path: filePath,
        content: originalContent,
        options: this.options,
      });

      const html = layout(context);

      fse.outputFileSync(resolvedDistPath, html);

      const endTime = new Date();

      console.log(`Generated ${resolvedDistPath} ......`+(endTime.getTime()-startTime.getTime())+'ms');
    });
  }

  delMd(filePath){
    const distPath = path.resolve(this.options.distDir, filePath).replace(/\.md$/, '.html');
    this.removeFile(distPath);
  }

  deleteStaticFile(filePath){
    const distPath = path.resolve(this.options.distDir, filePath);
    this.removeFile(distPath);
  }

  buildMDByDel(layoutPath){
    layoutPath = path.relative(this.options.srcDir, layoutPath);
    const srcDir = path.resolve(this.options.srcDir, path.dirname(layoutPath));
    const distDir = path.resolve(this.options.distDir, path.dirname(layoutPath));

    let mdFiles = glob.sync('**/*.md', {
      cwd: srcDir
    });

    //filter sub has layout files
    mdFiles = mdFiles.filter(filePath => {
      filePath = path.resolve(srcDir, filePath);
      const fileDir = path.dirname(filePath);
     // console.log(fileDir);

      const lydir = findParentDir.sync(filePath, LAYOUT_FILENAME);
     // console.log(lydir, path.dirname(lydir));
      if(lydir===fileDir+path.sep){
        return false
      }
      return true;
    });

    if (mdFiles.length === 0) {
      console.log('No markdown files found');
      return;
    }

    mdFiles.forEach(filePath => {
      const resolvedFilePath = path.resolve(srcDir, filePath);
      const resolvedDistPath = path.resolve(distDir, filePath)
        .replace(/\.md$/, '.html');

      const layout = this.getLayout(resolvedFilePath);

      if (!layout) {
        console.error(`CANNOT find a layout for ${resolvedFilePath}, will skip this file`);
        return;
      }

      const originalContent = fse.readFileSync(resolvedFilePath, 'utf-8');
      
      const startTime = new Date();

      const context = processors.reduce((prevContext, processor) => processor(prevContext), {
        path: filePath,
        content: originalContent,
        options: this.options,
      });

      const html = layout(context);

      fse.outputFileSync(resolvedDistPath, html);

      const endTime = new Date();

      console.log(`Generated ${resolvedDistPath} ......`+(endTime.getTime()-startTime.getTime())+'ms');
    });
  }

  //delete layoutjs should delete cache，modify should refresh cache
  refreshCache(layoutPath, isRefresh){
    delete require.cache[layoutPath];
    isRefresh && require(layoutPath);
  }

  buildMDFiles(files){
    if (files.length === 0) {
      console.log('No markdown files found');
      return;
    }

    files.forEach(filePath => {
      const resolvedFilePath = path.resolve(this.options.srcDir, filePath);
      const resolvedDistPath = path.resolve(this.options.distDir, filePath)
        .replace(/\.md$/, '.html');

      const layout = this.getLayout(resolvedFilePath);

      if (!layout) {
        console.error(`CANNOT find a layout for ${resolvedFilePath}, will skip this file`);
        return;
      }

      const originalContent = fse.readFileSync(resolvedFilePath, 'utf-8');
      
      const startTime = new Date();

      const context = processors.reduce((prevContext, processor) => processor(prevContext), {
        path: filePath,
        content: originalContent,
        options: this.options,
      });

      const html = layout(context);

      fse.outputFileSync(resolvedDistPath, html);

      const endTime = new Date();

      console.log(`Generated ${resolvedDistPath} ......`+(endTime.getTime()-startTime.getTime())+'ms');
    });
  }

  copyStaticFiles() {
    const staticFiles = glob.sync('**/*', {
      ignore: [
        '**/*.md',
        '**/_*',
      ],
      nodir: true,
      cwd: this.options.srcDir,
    });

    if (staticFiles.length === 0) {
      return;
    }

    staticFiles.forEach(this.copySingleFile.bind(this));
  }

  copySingleFile(filePath){
      const resolvedFilePath = path.resolve(this.options.srcDir, filePath);
      const resolvedDistPath = path.resolve(this.options.distDir, filePath);

      fse.copySync(resolvedFilePath, resolvedDistPath);

      console.log(`Copied ${resolvedDistPath}`);
  }

  removeFile(filePath){
    fse.removeSync(filePath);
    console.log(`deleted ${filePath}`);
  }

  getLayout(currentPath) {
    const layoutDir = findParentDir.sync(currentPath, LAYOUT_FILENAME);

    if (!layoutDir) {
      return null;
    }

    /* eslint global-require:0 */
    const layout = require(path.resolve(layoutDir, LAYOUT_FILENAME));

    return layout;
  }
}

module.exports = (...args) => {
  const pagic = new Pagic(...args);
  return () => {
    pagic.build();
  };
};

module.exports.Pagic = Pagic;
