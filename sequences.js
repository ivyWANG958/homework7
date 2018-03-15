// Dimensions of sunburst.
// 定义画布宽度
var width = 750;
// 定义画布高度
var height = 600;
// 定义放射状的圆周的半径
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
// 此处定义光芒图左上角的 辅助显示访问序列的元素的相关尺寸：宽、高、空隙、间隔等
var b = {
    w: 200,
    h: 30,
    s: 3,
    t: 10
};

// Mapping of step names to colors.
// 定义页面对应的颜色值
var colors = {
    // "home": "#5687d1",
    // "product": "#7b615c",
    // "search": "#de783b",
    // "account": "#6ab975",
    // "other": "#a173d1",
    // "end": "#bbbbbb"
    "Support": "#e6e6ff",
    "Affairs": "#ccccff",
    "Economic": "#9999ff",
    "Education": "#6666ff",
    "Environment": "#4d4dff",
    "Health": "#3333ff",
    "Housing": "#1a1aff",
    "Infrastructure": "#0000ff",
    "Security": "#0000e6",
    "Welfare": "#0000b3"


};

// Total size of all segments; we set this later, after loading the data.
// 总的节点数目
var totalSize = 0;
// 定义svg画布
var vis = d3.select("#chart").append("svg:svg")
    // 设置画布的宽度
    .attr("width", width)
    // 设置画布的高度
    .attr("height", height)
    // 添加g元素
    .append("svg:g")
    // 设置g元素的id
    .attr("id", "container")
    // 定位g元素到画布中心
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

// 此处用d3.partition()来定义分区布局函数partition()
var partition = d3.partition()
    //设置布局的尺寸，由于是圆形的布局方式，因此尺寸大小通过[2 * Math.PI, radius * radius]确定
    .size([2 * Math.PI, radius * radius]);

// 定义一个圆弧生成器
var arc = d3.arc()
    // 设置圆弧的起始角度的获取方式
    .startAngle(function(d) { return d.x0; })
    // 设置圆弧的结束角度的获取方式
    .endAngle(function(d) { return d.x1; })
    // 设置圆弧的内半径的获取方式
    .innerRadius(function(d) { return Math.sqrt(d.y0); })
    // 设置圆弧的外半径的获取方式
    .outerRadius(function(d) { return Math.sqrt(d.y1); });
// Use d3.text and d3.csvParseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
// d3.text(url,[callback])用来读取url指定的文本文件，并对其执行callback函数

// d3.queue()
//     .defer(d3.csv, "visit_squences.csv")
//     .await(ready)

// function ready(error, data) {
//     if (error) {
//         console.log(error);
//     }
// }


d3.text("visit_sequences.csv", function(text) {
    // 将文本文件按行转换为数组
    var csv = d3.csvParseRows(text);

    // 将数组文件转换为以root为根节点的树形层次结构
    var json = buildHierarchy(csv);
    // 将树形结构的数据构造成可以用于可视化的形式
    createVisualization(json);
});

// d3.csv("/data/visit_sequences.csv", function(data) {
//     console.log(data[0]);
//     // 将数组文件转换为以root为根节点的树形层次结构
//     var json = buildHierarchy(data);
//     // 将树形结构的数据构造成可以用于可视化的形式
//     createVisualization(json);

// });

// Main function to draw and set up the visualization, once we have the data.
// 该方法用来将数据构造成可用于可视化的形式
function createVisualization(json) {

    // Basic setup of page elements.
    // 初始化光芒图左上角的表示页面访问序列的元素
    initializeBreadcrumbTrail();
    // 绘制图例legend
    drawLegend();

    // 切换是否显示图例
    d3.select("#togglelegend").on("click", toggleLegend);

    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    // 添加一个透明度为0的圆，来辅助监测鼠标动作的离开
    vis.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);
    // Turn the data into a d3 hierarchy and calculate the sums.
    // 对数据进行层级布局
    var root = d3.hierarchy(json)
        .sum(function(d) { return d.size; })
        .sort(function(a, b) { return b.value - a.value; });

    // For efficiency, filter nodes to keep only those large enough to see.
    // 为了提高效率，将值过于小的节点过滤掉，只留较大节点进行显示
    // partition()将root数据进行分区布局，类似树型结构，然后通过descendants将布局后的
    // 数据结构按照从根节点开始，以拓扑顺序跟随子节点进行排序，最后返回拓扑排序的节点数组
    var nodes = partition(root).descendants()
        .filter(function(d) {
            // 弧度大于0.005的节点保留
            return (d.x1 - d.x0 > 0.005); // 0.005 radians = 0.29 degrees
        });

    // 绘制圆弧
    var path = vis.data([json]).selectAll("path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("fill", function(d) { return colors[d.data.name]; })
        .style("opacity", 1)
        .on("mouseover", mouseover);

    // Add the mouseleave handler to the bounding circle.
    // 设置鼠标离开的事件监听
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    totalSize = path.datum().value;
};

// Fade all but the current sequence, and show it in the breadcrumb trail.
// 鼠标移动在当前节点上时，显示当前节点的路径，并且将该路径显示在左上角的序列中
function mouseover(d) {
    // 计算当前节点占比
    var percentage = (100 * d.value / totalSize).toPrecision(3);
    var percentageString = percentage + "%";
    if (percentage < 0.1) {
        percentageString = "< 0.1%";
    }
    // 左上角的序列中显示当前节点的百分比文字
    d3.select("#percentage")
        .text(percentageString);

    // 填充圆弧中心的解释性文字
    d3.select("#explanation")
        .style("visibility", "");

    // ancestors()从当前节点开始，返回祖先节点的数组，一直到根节点结束
    // reverse()将该数组反转
    var sequenceArray = d.ancestors().reverse();
    // 反转后根节点位于第一个位置，将其移除
    sequenceArray.shift(); // remove root node from the array
    // 绘制坐上角的序列图形
    updateBreadcrumbs(sequenceArray, percentageString);

    // Fade all the segments.
    // 先将所有的path元素的透明度都设置为0.3，以便后面高亮显示当前路径上的节点元素
    d3.selectAll("path")
        .style("opacity", 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    // 将当前节点的所有父节点高亮显示，将其透明度设置为1
    vis.selectAll("path")
        .filter(function(node) {
            return (sequenceArray.indexOf(node) >= 0);
        })
        .style("opacity", 1);
}
// Restore everything to full opacity when moving off the visualization.
// 当鼠标离开时，将所有的元素恢复为透明度为1的状态
function mouseleave(d) {

    // Hide the breadcrumb trail
    // 将左上角的序列隐藏
    d3.select("#trail")
        .style("visibility", "hidden");

    // Deactivate all segments during transition.
    // 先停止在鼠标移动经过节点时的动作监听
    d3.selectAll("path").on("mouseover", null);

    // Transition each segment to full opacity and then reactivate it.
    // 将所有元算设置为透明度1，并且启动mouseover监听
    d3.selectAll("path")
        .transition()
        .duration(1000)
        .style("opacity", 1)
        // 重新启用mouseover监听
        .on("end", function() {
            d3.select(this).on("mouseover", mouseover);
        });
    // 隐藏圆弧中间的百分比信息
    d3.select("#explanation")
        .style("visibility", "hidden");
}
// 该方法用来初始化光芒图的左上角的用于辅助显示访问序列的元素
function initializeBreadcrumbTrail() {
    // Add the svg area.
    // 创建一个svg画布
    var trail = d3.select("#sequence").append("svg:svg")
        // 设置画布的宽度
        .attr("width", width)
        // 设置画布的高度
        .attr("height", 50)
        // 设置画布的id
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    // 在页面序列元素后，添加显示序列访问频率的百分比的文本显示元素
    trail.append("svg:text")
        .attr("id", "endlabel")
        .style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
// 生成绘制左上角序列多边形图形的路径数据
function breadcrumbPoints(d, i) {
    var points = [];
    points.push("0,0");
    // 变量b是在前面定义的关于 序列多边形的相关尺寸数据
    points.push(b.w + ",0");
    points.push(b.w + b.t + "," + (b.h / 2));
    points.push(b.w + "," + b.h);
    points.push("0," + b.h);
    if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(b.t + "," + (b.h / 2));
    }
    return points.join(" ");
}
// Update the breadcrumb trail to show the current sequence and percentage.
// 根据当前鼠标悬浮的节点的路径，更新左上角的序列
function updateBreadcrumbs(nodeArray, percentageString) {

    // Data join; key function combines name and depth (= position in sequence).
    // 根据name 和depth来计算节点在序列中的位置
    // 为序列绑定数据nodeArray
    var trail = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function(d) { return d.data.name + d.depth; });

    // Remove exiting nodes.
    // 删除多于的元素
    trail.exit().remove();

    // Add breadcrumb and label for entering nodes.
    // 根据节点的个数在生成对应的显示node的元素节点数目
    var entering = trail.enter().append("svg:g");

    // 绘制左上角的序列的图形，以多边形polygon元素来绘制
    entering.append("svg:polygon")
        .attr("points", breadcrumbPoints)
        .style("fill", function(d) { return colors[d.data.name]; });

    entering.append("svg:text")
        .attr("x", (b.w + b.t) / 2)
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.data.name; });

    // Merge enter and update selections; set position for all nodes.
    entering.merge(trail).attr("transform", function(d, i) {
        return "translate(" + i * (b.w + b.s) + ", 0)";
    });
    // Now move and update the percentage at the end.
    d3.select("#trail").select("#endlabel")
        .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
        .style("visibility", "");

}

// 绘制图列
function drawLegend() {

    // Dimensions of legend item: width, height, spacing, radius of rounded rect.
    // 设置图列的一些尺寸信息:宽、高、间隔、矩形圆角半径
    var li = {
        w: 75,
        h: 30,
        s: 3,
        r: 3
    };

    // 定义图列的画布
    var legend = d3.select("#legend").append("svg:svg")
        // 设置图例宽度
        .attr("width", li.w)
        // 设置图列高度
        .attr("height", d3.keys(colors).length * (li.h + li.s));
    // 定义g元素，用来绘制图例
    var g = legend.selectAll("g")
        // d3.entries(colors)将colors数组转换成对象数组，每个对象由key,value字段组成
        // 将转换后的数据绑定到g元素上，转换后的数据，key为页面名称，value为页面颜色
        .data(d3.entries(colors))
        .enter().append("svg:g")
        // 定位每个g元素，所有图列元素排成一列
        .attr("transform", function(d, i) {
            return "translate(0," + i * (li.h + li.s) + ")";
        });

    // 以矩形来表示每个图例
    g.append("svg:rect")
        .attr("rx", li.r) // 设置矩形的圆角半径
        .attr("ry", li.r) // 设置矩形的圆角半径
        .attr("width", li.w) // 设置矩形的宽度
        .attr("height", li.h) // 设置矩形的高度
        // 用网页对应的颜色来填充对应的图例
        .style("fill", function(d) { return d.value; });

    // 为每个图例矩形添加文本描述
    g.append("svg:text")
        .attr("x", li.w / 2)
        .attr("y", li.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.key; });
}

// 控制图列的显示与隐藏
function toggleLegend() {
    var legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
        legend.style("visibility", "");
    } else {
        legend.style("visibility", "hidden");
    }
} // Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how 
// often that sequence occurred.
// 采取两列csv文件的方式，将csv数据转换成分区布局所需要的结构格式
// 第一列表示访问序列的名字，name字段，访问序列从父页面到叶子页面；
// 第二列表示name字段对应的序列的访问频率
// 两列之间用逗号隔开
function buildHierarchy(csv) {
    var root = { "name": "root", "children": [] };
    for (var i = 0; i < csv.length; i++) {
        // csv[i][0]中存储的是将要放进name字段的值
        var sequence = csv[i][0];
        // csv[i][1]中存储的是sequence序列的访问频率，是数字类型
        var size = +csv[i][1];
        if (isNaN(size)) { // e.g. if this is a header row
            continue;
        }
        // 由于sequence都是以中杠将访问序列中的页面名称连接的，此处以中杠作为分隔符将其转换为数组
        var parts = sequence.split("-");
        // 先初始化当前节点
        var currentNode = root;
        for (var j = 0; j < parts.length; j++) {
            // 初始化当前节点的children字段
            var children = currentNode["children"];
            // 获取当前节点的名称
            var nodeName = parts[j];
            var childNode;
            if (j + 1 < parts.length) {
                // Not yet at the end of the sequence; move down the tree.
                // 若未到序列的最后，则继续进行
                var foundChild = false;
                for (var k = 0; k < children.length; k++) {
                    if (children[k]["name"] == nodeName) {
                        childNode = children[k];
                        foundChild = true;
                        break;
                    }
                } // If we don't already have a child node for this branch, create it.
                // 若此节点还没有创建子节点，那么为其创建
                if (!foundChild) {
                    childNode = { "name": nodeName, "children": [] };
                    children.push(childNode);
                }
                currentNode = childNode;
            } else {
                // Reached the end of the sequence; create a leaf node.
                // 若已经到序列的结尾，则创建叶子节点，叶子节点和中间节点不同，叶子节点由name和size字段组成
                childNode = { "name": nodeName, "size": size };
                children.push(childNode);
            }
        }
    }
    return root;
};