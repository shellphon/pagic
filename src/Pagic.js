/* eslint no-console:0 */

const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const findParentDir = require('find-parent-dir');

const chokidar = require('chokidar');

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

const detectFile = function(filepath){
   const ext = path.extname(filepath);
   if(ext!=='.js'){
     return ext;
   }
   if(path.basename(filepath,'.js')==='_layout'){
      return 'layout';
   }
   return ext;
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

    if(this.options.watch){
       var watcher = chokidar.watch(this.options.srcDir);

        //init scan ready for watchfile
        watcher.on('ready', () =>{
          watcher.on('add', (filepath, stats) =>{
            /*
              新增md文件: 文件路径=>生成
              ，其他文件 文件路径=>拷贝
              ，layout文件 文件路径=> 从当前目录开始，所有md文件，如果md文件（除了当前目录）的目录没有layout文件，都重新生成
            */
            console.log('add:', filepath);
            if(detectFile(filepath)==='.md'){
              this.addMd(filepath);
              return;
            }

            if(detectFile(filepath)==='layout'){
              this.buildMDByAdd(filepath);
              return;
            }

            this.copyFile(filepath);
             
            
            //this.build();
            
            
          }).on('unlink', filepath =>{
            /*
              删除md文件: 文件路径=>删除html文件
              删除其他文件: 文件路径=> 删除对应文件
              删除layout文件: 文件路径=>当前目录开始，所有md文件，如果md文件目录没有layout，都重新生成
            */
            console.log('delete:',filepath);

            if(detectFile(filepath)==='.md'){
              this.delMd(filepath);
              return;
            }

            if(detectFile(filepath)==='layout'){
              this.buildMDByDel(filepath);
              return;
            }

            this.deleteStaticFile(filepath);
              
            
            //this.build();
          }).on('change', (filepath, stats) =>{
            /*
              修改md文件：文件路径=>重新生成
              修改其他文件：文件路径=>覆盖
              修改layout文件：文件路径=> 当前目录开始，所有md文件，如果所在目录(当前目录除外)没有layout文件，则重新生成
            */
            console.log('change:', filepath);

            if(detectFile(filepath)==='.md'){
              this.addMd(filepath);
              return;
            }

            if(detectFile(filepath)==='layout'){
              this.buildMDByModify(filepath);
              return;
            }

            this.copyFile(filepath);
            
            //pagic.build();
          }).on('error', error =>{
            console.log('watcher error: ${error}', error);
            watcher.close();
          });
        });
    }
  }

  clearDistDir() {
    fse.emptyDirSync(this.options.distDir);
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

  buildMD() {
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.options.srcDir,
    });

    this.buildMDFiles(mdFiles);
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

    staticFiles.forEach(filePath => {
      this.copySingleFile(filePath);
    });
  }

  copySingleFile(filePath, srcDir = this.options.srcDir, distDir = this.options.distDir){
      const resolvedFilePath = path.resolve(srcDir, filePath);
      const resolvedDistPath = path.resolve(distDir, filePath);

      fse.copySync(resolvedFilePath, resolvedDistPath);

      console.log(`Copied ${resolvedDistPath}`);
  }

  /* base function to build md files */
  buildMDFiles(mdFiles, srcDir = this.options.srcDir, distDir = this.options.distDir) {

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

  /**
     watch directories to rebuild relative files
  **/

  /* rebuild md files while layout file change */
  reBuildMD(layoutPath, needFresh = false, rebuildBase = true){
    layoutPath = path.relative(this.options.srcDir, layoutPath);
    const srcDir = path.resolve(this.options.srcDir, path.dirname(layoutPath));
    const distDir = path.resolve(this.options.distDir, path.dirname(layoutPath));

    let mdFiles = glob.sync('**/*.md', {
      cwd: srcDir
    });
    if(needFresh){
      this.refreshCache(path.resolve(srcDir, LAYOUT_FILENAME));
    }

    //ignore sub directory that has _layout.js
    mdFiles = mdFiles.filter(filePath => {
      filePath = path.resolve(srcDir, filePath);
      const fileDir = path.dirname(filePath);

      //base md file should stay : new layout or fresh layout
      if(rebuildBase && srcDir===fileDir) return true;

      const lydir = findParentDir.sync(filePath, LAYOUT_FILENAME);
     
      if(lydir===fileDir+path.sep){
        return false
      }
      return true;
    });

    this.buildMDFiles(mdFiles, srcDir, distDir);
  }

  addMd(filePath){
    filePath = path.relative(this.options.srcDir, filePath);
    this.buildMDFiles([filePath]);
  }

  buildMDByModify(layoutPath){
    this.buildMDByAdd(layoutPath, true);
  }

  buildMDByAdd(layoutPath, needFresh = false){
    this.reBuildMD(layoutPath, needFresh)
  }

  buildMDByDel(layoutPath){
    this.reBuildMD(layoutPath, false, false)
  }

  delMd(filePath){
    filePath = path.relative(this.options.srcDir, filePath);
    const distPath = path.resolve(this.options.distDir, filePath).replace(/\.md$/, '.html');
    this.removeFile(distPath);
  }

  deleteStaticFile(filePath){
    filePath = path.relative(this.options.srcDir, filePath);
    const distPath = path.resolve(this.options.distDir, filePath);
    this.removeFile(distPath);
  }

  //require layout should refresh the cache for layoutfile modify or delete
  refreshCache(layoutPath, isRefresh){
    delete require.cache[layoutPath];
    isRefresh && require(layoutPath);
  }

  removeFile(filePath){
    fse.removeSync(filePath);
    console.log(`deleted ${filePath}`);
  }

  copyFile(filePath){
    filePath = path.relative(this.options.srcDir, filePath)
    this.copySingleFile(filePath)
  }
}

module.exports = Pagic;