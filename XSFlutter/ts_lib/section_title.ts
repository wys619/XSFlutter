
import js = require("./js_flutter_sdk"); 

export class SectionTitle extends js.JSStatelessWidget{
  title:string;
  constructor(title:string){
    super("SectionTitle");
    this.title = title;
  }

  
  build(buildContext:js.JSBuildContext){
    return js.Container.new({
      padding:js.EdgeInsets.all(10.0),
      color:js.Colors.black26,
      child:js.Row.new({
        mainAxisAlignment:js.MainAxisAlignment.center,
        children:[
          js.Icon.new(
            js.Icons.ac_unit
          ),
          js.Text.new("兴盛优选"),
        ]
      }),
    });
  }
}
 /*
  class SectionTitle extends JSStatelessWidget {
    
    build(context){
      return new Container({
        padding: EdgeInsets.all(10.0),
        color: Colors.red,// Theme.of(context).primaryColor,
        child: new Row({
          children: [
            new Icon(new IconData(0xe80e, { fontFamily: 'MaterialIcons' }), { size: 20, color: new Color(0xFFFFFFFF) }),
            new Padding({ padding: EdgeInsets.fromLTRB(10.0, 0.0, 0.0, 0.0) }),
            new Text(this.title, {
              textAlign: TextAlign.start,
              style:new TextStyle({
                fontSize: 16,
                //fontWeight: Theme.of(context).textTheme.title.fontWeight,
                color:Colors.white
              })
            })
          ]
        })
      });
    }
  }
  
  module.exports = {
    SectionTitle,
  }
  */
  